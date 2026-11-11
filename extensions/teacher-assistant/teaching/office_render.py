"""Render an owned, single-page PPTX with installed Windows Office applications."""

import json
from pathlib import Path
import subprocess

from hermes_platform import resolver
from pydantic import ValidationError

from .database import encode
from .models import DomainError
from .layout_repair import OfficeMetadata


def powershell_command():
    resolution = resolver.locate_command("powershell.exe")
    if not resolution.found:
        raise DomainError("render_host_unavailable", "未找到Windows PowerShell，无法启动本地Office渲染")
    return resolution.command


def render(input_path, work, renderer):
    from PIL import Image

    command = powershell_command()
    script = Path(__file__).resolve().parents[1] / "scripts/render_slide.ps1"
    source_path = work / "source.pptx"
    # A private copy guarantees that closing this render cannot close a document the teacher already opened.
    with source_path.open("xb") as stream:
        stream.write(input_path.read_bytes())
    output_path = work / "rendered.png"
    request_path = work / "render-request.json"
    request_path.write_text(encode({"renderer": renderer, "input_path": str(source_path), "output_path": str(output_path)}), encoding="utf-8")
    try:
        result = subprocess.run([*command, "-NoProfile", "-NonInteractive", "-File", str(script), "-RequestPath", str(request_path)],
                                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=90, check=False,
                                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
    except subprocess.TimeoutExpired as exc:
        raise DomainError("render_timeout", "本地Office渲染超时，请检查办公软件状态") from exc
    try:
        response = json.loads(result.stdout.lstrip("\ufeff").strip())
    except ValueError as exc:
        raise DomainError("render_response_invalid", "本地Office渲染未返回有效结果，请查看运行日志") from exc
    if not isinstance(response, dict):
        raise DomainError("render_response_invalid", "本地Office渲染结果格式不正确")
    if result.returncode or response.get("ok") is not True:
        code = "office_unavailable" if response.get("error") == "office_unavailable" else "office_render_failed"
        raise DomainError(code, "本地办公软件未能完成渲染，请检查所选WPS或PowerPoint是否可用")
    if not output_path.is_file() or not 0 < output_path.stat().st_size <= 30 * 1024 * 1024:
        raise DomainError("render_response_invalid", "本地Office未生成有效大小的预览图片")
    with Image.open(output_path) as image:
        if image.format != "PNG" or image.size != (1600, 900):
            raise DomainError("render_response_invalid", "本地Office预览图片尺寸或格式不正确")
        image.verify()
    try:
        metadata = OfficeMetadata.model_validate({"version": str(response.get("version", "unknown"))[:100],
            "measurements": response.get("measurements", []), "unmeasured_objects": response.get("unmeasured_objects", [])})
    except ValidationError as exc:
        raise DomainError("render_response_invalid", "办公软件返回的文字测量格式不正确") from exc
    return output_path.read_bytes(), metadata.model_dump()
