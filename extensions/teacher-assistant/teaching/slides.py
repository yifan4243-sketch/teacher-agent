"""Native editable slide objects, shared by image reconstruction and blueprint export."""

from contextlib import ExitStack
from io import BytesIO
from math import ceil, floor
from pathlib import Path
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .models import Input


Color = Annotated[str, Field(pattern=r"^[0-9A-Fa-f]{6}$")]


class Element(Input):
    name: str = Field(min_length=1, max_length=120)
    x: float = Field(ge=0, allow_inf_nan=False)
    y: float = Field(ge=0, allow_inf_nan=False)
    width: float = Field(gt=0, allow_inf_nan=False)
    height: float = Field(gt=0, allow_inf_nan=False)


class TextElement(Element):
    kind: Literal["text"]
    text: str = Field(min_length=1, max_length=5000)
    font_size: float = Field(ge=8, le=160, allow_inf_nan=False)
    color: Color = "102044"
    bold: bool = False
    align: Literal["left", "center", "right"] = "left"


class ShapeElement(Element):
    kind: Literal["shape"]
    shape: Literal["rectangle", "rounded_rectangle", "ellipse"]
    fill: Color | None = None
    line_color: Color | None = None
    line_width: float = Field(default=1.5, ge=0, le=20, allow_inf_nan=False)


class LineElement(Element):
    kind: Literal["line"]
    color: Color = "123D92"
    line_width: float = Field(default=2, gt=0, le=20, allow_inf_nan=False)
    direction: Literal["horizontal", "vertical", "down", "up"] = "horizontal"


class ImageElement(Element):
    kind: Literal["image"]
    source_x: float = Field(ge=0, allow_inf_nan=False)
    source_y: float = Field(ge=0, allow_inf_nan=False)
    source_width: float = Field(ge=1, allow_inf_nan=False)
    source_height: float = Field(ge=1, allow_inf_nan=False)
    description: str = Field(min_length=1, max_length=500)


class TableElement(Element):
    kind: Literal["table"]
    rows: list[list[str]] = Field(min_length=1, max_length=30)
    font_size: float = Field(default=30, ge=8, le=100, allow_inf_nan=False)
    column_weights: list[float] = Field(default_factory=list)
    header_fill: Color = "175CBA"
    body_fill: Color = "FFFFFF"
    first_column_fill: Color = "E3EFFC"
    color: Color = "102044"

    @model_validator(mode="after")
    def rectangular(self):
        columns = len(self.rows[0])
        if not 1 <= columns <= 12 or any(len(row) != columns for row in self.rows):
            raise ValueError("表格必须具有一致的列数，最多12列")
        if self.column_weights and (len(self.column_weights) != columns or any(weight <= 0 for weight in self.column_weights)):
            raise ValueError("表格列宽权重必须与列数一致且大于0")
        if any(len(cell) > 2000 for row in self.rows for cell in row):
            raise ValueError("表格单元格内容过长")
        return self


SlideElement = Annotated[TextElement | ShapeElement | LineElement | TableElement | ImageElement, Field(discriminator="kind")]


class SlideLayout(Input):
    title: str = Field(min_length=1, max_length=200)
    width: float = Field(ge=320, le=8192, allow_inf_nan=False)
    height: float = Field(ge=180, le=8192, allow_inf_nan=False)
    background: Color = "FFFFFF"
    elements: list[SlideElement] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def bounds(self):
        names = [element.name for element in self.elements]
        if len(names) != len(set(names)):
            raise ValueError("页面对象名称必须唯一")
        if any(element.x + element.width > self.width + 1 or element.y + element.height > self.height + 1 for element in self.elements):
            raise ValueError("页面对象超出画布范围")
        images = [element for element in self.elements if element.kind == "image"]
        if images and len(images) == len(self.elements):
            raise ValueError("课件页面需要保留原生可编辑对象")
        if sum(element.width * element.height for element in images) >= self.width * self.height * 0.9:
            raise ValueError("图片覆盖面积需小于画布90%，避免整页位图替代可编辑页面")
        if any(element.source_x + element.source_width > self.width or element.source_y + element.source_height > self.height
               or element.source_width * element.source_height >= self.width * self.height * 0.9 for element in images):
            raise ValueError("裁切区域需位于原图范围内，且小于原图90%")
        return self


def _font(paragraph, size, color, bold=False):
    from pptx.dml.color import RGBColor
    from pptx.oxml.xmlchemy import OxmlElement
    from pptx.util import Pt

    paragraph.font.name = "Microsoft YaHei"
    paragraph.font.size = Pt(size)
    paragraph.font.bold = bold
    paragraph.font.color.rgb = RGBColor.from_string(color)
    for run in paragraph.runs:
        properties = run._r.get_or_add_rPr()
        east_asian = OxmlElement("a:ea")
        east_asian.set("typeface", "Microsoft YaHei")
        properties.append(east_asian)


def _draw_text(slide, element, box, _scale, points, _source_image):
    from pptx.enum.text import PP_ALIGN

    shape = slide.shapes.add_textbox(*box)
    frame = shape.text_frame
    frame.margin_left = frame.margin_right = 0
    frame.margin_top = frame.margin_bottom = 0
    frame.word_wrap = True
    for index, line in enumerate(element.text.splitlines()):
        paragraph = frame.paragraphs[0] if index == 0 else frame.add_paragraph()
        paragraph.text = line
        paragraph.alignment = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT}[element.align]
        _font(paragraph, element.font_size * points, element.color, element.bold)
    return shape


def _draw_shape(slide, element, box, _scale, points, _source_image):
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_AUTO_SHAPE_TYPE
    from pptx.util import Pt

    shape = slide.shapes.add_shape({"rectangle": MSO_AUTO_SHAPE_TYPE.RECTANGLE, "rounded_rectangle": MSO_AUTO_SHAPE_TYPE.ROUNDED_RECTANGLE,
                                   "ellipse": MSO_AUTO_SHAPE_TYPE.OVAL}[element.shape], *box)
    if element.fill:
        shape.fill.solid()
        shape.fill.fore_color.rgb = RGBColor.from_string(element.fill)
    else:
        shape.fill.background()
    if element.line_color:
        shape.line.color.rgb = RGBColor.from_string(element.line_color)
        shape.line.width = Pt(element.line_width * points)
    else:
        shape.line.fill.background()
    return shape


def _draw_line(slide, element, box, _scale, points, _source_image):
    from pptx.dml.color import RGBColor
    from pptx.enum.shapes import MSO_CONNECTOR
    from pptx.util import Pt

    x, y, width, height = box
    ends = {"horizontal": (x, y, x + width, y), "vertical": (x, y, x, y + height),
            "down": (x, y, x + width, y + height), "up": (x, y + height, x + width, y)}
    shape = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, *ends[element.direction])
    shape.line.color.rgb = RGBColor.from_string(element.color)
    shape.line.width = Pt(element.line_width * points)
    return shape


def _draw_image(slide, element, box, _scale, _points, source_image):
    bounds = (floor(element.source_x), floor(element.source_y), ceil(element.source_x + element.source_width), ceil(element.source_y + element.source_height))
    output = BytesIO()
    with source_image.crop(bounds).convert("RGBA") as cropped:
        cropped.save(output, format="PNG")
    output.seek(0)
    shape = slide.shapes.add_picture(output, *box)
    shape._element.nvPicPr.cNvPr.set("descr", element.description)
    return shape


def _draw_table(slide, element, box, scale, points, _source_image):
    from pptx.dml.color import RGBColor
    from pptx.enum.text import MSO_ANCHOR, PP_ALIGN
    from pptx.oxml.xmlchemy import OxmlElement

    shape = slide.shapes.add_table(len(element.rows), len(element.rows[0]), *box)
    table = shape.table
    weights = element.column_weights or [1] * len(element.rows[0])
    for index, weight in enumerate(weights):
        table.columns[index].width = round(box[2] * weight / sum(weights))
    for row_index, row in enumerate(element.rows):
        for column, text in enumerate(row):
            cell = table.cell(row_index, column)
            cell.text = text
            cell.margin_left = cell.margin_right = round(8 * scale)
            cell.margin_top = cell.margin_bottom = 0
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE
            fill = element.header_fill if row_index == 0 else element.first_column_fill if column == 0 else element.body_fill
            cell.fill.solid()
            cell.fill.fore_color.rgb = RGBColor.from_string(fill)
            for edge in ("lnL", "lnR", "lnT", "lnB"):
                border = OxmlElement("a:" + edge)
                border.set("w", "12700")
                solid = OxmlElement("a:solidFill")
                color = OxmlElement("a:srgbClr")
                color.set("val", "2462AF")
                solid.append(color)
                border.append(solid)
                cell._tc.get_or_add_tcPr().append(border)
            paragraph = cell.text_frame.paragraphs[0]
            paragraph.alignment = PP_ALIGN.CENTER
            _font(paragraph, element.font_size * points, "FFFFFF" if row_index == 0 else element.color, row_index == 0 or column == 0)
    return shape


_ELEMENT_RENDERERS = {"text": _draw_text, "shape": _draw_shape, "line": _draw_line, "table": _draw_table, "image": _draw_image}


def _draw(slide, element, scale, points, source_image=None):
    from pptx.oxml.ns import qn

    box = tuple(round(value * scale) for value in (element.x, element.y, element.width, element.height))
    shape = _ELEMENT_RENDERERS[element.kind](slide, element, box, scale, points, source_image)
    shape.name = element.name
    style = shape._element.find(qn("p:style"))
    if style is not None:
        shape._element.remove(style)


def export_pptx(layouts, destination, *, source_images=None):
    """Create an exclusive output file and retain all text, table cells and geometry."""
    from pptx import Presentation
    from pptx.dml.color import RGBColor
    from pptx.util import Inches

    parsed = [SlideLayout.model_validate(layout) for layout in layouts]
    if not parsed or any(abs(layout.width / layout.height - 16 / 9) > 0.01 for layout in parsed):
        raise ValueError("课件需要至少一页16比9布局")
    if source_images is not None and len(source_images) != len(parsed):
        raise ValueError("设计图来源数量需与布局页数一致")
    presentation = Presentation()
    presentation.slide_width = Inches(40 / 3)
    presentation.slide_height = Inches(7.5)
    for index, layout in enumerate(parsed):
        slide = presentation.slides.add_slide(presentation.slide_layouts[6])
        slide.background.fill.solid()
        slide.background.fill.fore_color.rgb = RGBColor.from_string(layout.background)
        scale = presentation.slide_width / layout.width
        with ExitStack() as sources:
            source_image = None
            if any(element.kind == "image" for element in layout.elements):
                from PIL import Image

                if source_images is None or source_images[index] is None:
                    raise ValueError("图片对象需要当前页面的真实设计图来源")
                source_image = sources.enter_context(Image.open(source_images[index]))
                if source_image.size != (layout.width, layout.height):
                    raise ValueError("图片来源尺寸与页面布局不一致")
            for element in layout.elements:
                _draw(slide, element, scale, 540 / layout.height, source_image)
        slide.notes_slide.notes_text_frame.text = layout.title
    with Path(destination).open("xb") as stream:
        presentation.save(stream)
    return Path(destination)
