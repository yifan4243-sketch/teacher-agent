"""Use measured Office text bounds to create a readable draft with smaller fonts."""

from copy import deepcopy
from math import floor

from pydantic import Field, model_validator

from .database import audit, encode
from .models import DomainError, Identifier, Input


class TextMeasurement(Input):
    element_name: str = Field(min_length=1, max_length=120)
    row: int | None = Field(default=None, ge=0, le=29, strict=True)
    column: int | None = Field(default=None, ge=0, le=11, strict=True)
    frame_width: float = Field(ge=0, allow_inf_nan=False)
    frame_height: float = Field(ge=0, allow_inf_nan=False)
    content_width: float = Field(ge=0, allow_inf_nan=False)
    content_height: float = Field(ge=0, allow_inf_nan=False)
    font_size: float = Field(gt=0, allow_inf_nan=False)

    @model_validator(mode="after")
    def cell_coordinates(self):
        if (self.row is None) != (self.column is None):
            raise ValueError("表格测量需同时提供行和列")
        return self


class OfficeMetadata(Input):
    version: str = Field(default="unknown", max_length=100)
    measurements: list[TextMeasurement] = Field(default_factory=list, max_length=500)
    unmeasured_objects: list[str] = Field(default_factory=list, max_length=500)


class RepairRequest(Identifier):
    minimum_font_pixels: float = Field(default=32, ge=8, le=160, allow_inf_nan=False)


def _planned_bounds(element, canvas_width, measurement):
    points = 960 / canvas_width
    width, height = element["width"], element["height"]
    if element["kind"] == "table":
        weights = element.get("column_weights") or [1] * len(element["rows"][0])
        width = max(0, width * weights[measurement.column] / sum(weights) - 16)
        height /= len(element["rows"])
    # Office can expand table rows while opening the file; that expansion is itself a layout defect.
    return measurement.model_copy(update={"frame_width": min(measurement.frame_width, width * points),
                                          "frame_height": min(measurement.frame_height, height * points)})


def inspect_layout(layout, measurements):
    observed = {(item["element_name"], item.get("row"), item.get("column")): TextMeasurement.model_validate(item) for item in measurements}
    factors, overflows, missing = {}, [], []
    missing_count = 0
    for element in layout["elements"]:
        keys = []
        if element["kind"] == "text":
            keys = [(element["name"], None, None)]
        elif element["kind"] == "table":
            keys = [(element["name"], row, column) for row, cells in enumerate(element["rows"]) for column, text in enumerate(cells) if text.strip()]
        for key in keys:
            measurement = observed.get(key)
            if measurement is None:
                missing_count += 1
                if len(missing) < 100:
                    missing.append({"element_name": key[0], "row": key[1], "column": key[2]})
                continue
            measurement = _planned_bounds(element, layout["width"], measurement)
            width_overflow = measurement.content_width > measurement.frame_width + 0.5
            height_overflow = measurement.content_height > measurement.frame_height + 0.5
            if width_overflow or height_overflow:
                ratio = min(measurement.frame_width / measurement.content_width if width_overflow else 1,
                            measurement.frame_height / measurement.content_height if height_overflow else 1)
                factors[element["name"]] = min(factors.get(element["name"], 1), ratio * 0.96)
                overflows.append(measurement.model_dump())
    return {"factors": factors, "overflows": overflows, "missing": missing, "missing_regions": missing_count, "measured_regions": len(observed)}


def fit_fonts(layout, measurements, minimum_font_pixels):
    report = inspect_layout(layout, measurements)
    updated = deepcopy(layout)
    changes, limited = [], []
    for element in updated["elements"]:
        ratio = report["factors"].get(element["name"])
        if ratio is None:
            continue
        before = element["font_size"]
        font_size = min(before, max(minimum_font_pixels, floor(before * ratio * 10) / 10))
        if font_size < before:
            element["font_size"] = font_size
            changes.append({"element_name": element["name"], "from_font_pixels": before, "to_font_pixels": font_size})
        if font_size <= minimum_font_pixels:
            limited.append(element["name"])
    return updated, {**report, "changes": changes, "minimum_limited": limited,
                     "method": "按实际字宽字高比例缩小字号，保留4%余量，遵守教师设置的最小原图像素字号"}


def repair(conn, data, actor):
    from . import reconstruction, rendering

    job = rendering.get_job(conn, data)
    if job["state"] != "succeeded":
        raise DomainError("render_required", "请先完成当前页面的实际渲染")
    measurements = job["comparison"].get("measurements", [])
    if not measurements:
        raise DomainError("text_measurement_required", "当前预览缺少文字测量，请新建渲染任务后修复")
    page = reconstruction.get_page(conn, Identifier(id=job["page_id"]))
    latest = conn.execute("SELECT MAX(version) FROM slide_pages WHERE blueprint_id=? AND page_number=?", (page["blueprint_id"], page["page_number"])).fetchone()[0]
    if page["version"] != latest:
        raise DomainError("version_conflict", "页面已有新版本，请对最新版本重新渲染后修复")
    layout, report = fit_fonts(page["layout"], measurements, data.minimum_font_pixels)
    saved = reconstruction.revise(conn, reconstruction.PageRevision(id=page["id"], layout=layout), actor) if report["changes"] else page
    if report["changes"]:
        conn.execute("INSERT INTO slide_page_repairs(page_id,render_job_id,minimum_font_pixels,report_json) VALUES(?,?,?,?)",
                     (saved["id"], data.id, data.minimum_font_pixels, encode(report)))
        saved = reconstruction.get_page(conn, Identifier(id=saved["id"]))
    result = {"page": saved, "render_job_id": data.id, "report": report, "changed": bool(report["changes"])}
    audit(conn, "slide_page", saved["id"], "fit_measured_text", actor, {"page_id": page["id"], "render_job_id": data.id}, result)
    return result
