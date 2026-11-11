"""Use Hermes' published tool registry and original image provider contracts."""

import hashlib
import json
from pathlib import Path
from urllib.parse import urlsplit

from .models import DomainError


def config_fingerprint():
    from hermes_constants import get_hermes_home

    path = get_hermes_home() / "config.yaml"
    return hashlib.sha256(path.read_bytes() if path.exists() else b"").hexdigest()


def tool_entry():
    from tools.registry import discover_builtin_tools, registry

    entry = registry.get_entry("image_generate")
    if entry is None:
        discover_builtin_tools()
        entry = registry.get_entry("image_generate")
    if entry is None or (entry.check_fn is not None and not entry.check_fn()):
        raise DomainError("image_provider_not_configured", "请先在Hermes技能与工具中配置可用的生图服务")
    return entry


def require_reference_support():
    entry = tool_entry()
    schema = {**entry.schema, **(entry.dynamic_schema_overrides() if entry.dynamic_schema_overrides else {})}
    if "image_url" not in schema.get("parameters", {}).get("properties", {}):
        raise DomainError("reference_not_supported", "当前生图模型未声明支持参考图片，请切换支持的模型或取消参考素材")


def generate(prompt, task_id, *, reference_image=None):
    from tools.registry import registry

    arguments = {"prompt": prompt, "aspect_ratio": "landscape"}
    if reference_image is not None:
        arguments["image_url"] = reference_image
    raw = registry.dispatch("image_generate", arguments, task_id=task_id)
    result = json.loads(raw) if isinstance(raw, str) else raw
    if not isinstance(result, dict) or result.get("success") is not True:
        raise DomainError("image_provider_failed", "原生生图服务未返回成功结果，请核查服务状态和调用记录")
    image = result.get("image")
    if not isinstance(image, str) or not image:
        raise DomainError("invalid_image_response", "生图服务缺少图像文件")
    if urlsplit(image).scheme in {"https", "http"}:
        from agent.image_gen_provider import save_url_image
        path = save_url_image(image, prefix="teacher-slide")
    else:
        path = Path(image)
    from hermes_constants import get_hermes_home
    from .files import file_root

    allowed = (get_hermes_home() / "cache" / "generated" / "images", file_root())
    if not path.is_absolute() or not any(path.resolve().is_relative_to(root.resolve()) for root in allowed):
        raise DomainError("invalid_image_response", "生图结果文件需要位于当前配置的生成图像目录")
    return path, {"provider": str(result.get("provider", ""))[:200], "model": str(result.get("model", ""))[:200],
                  "reported_cost_usd": result.get("cost_usd")}


def read_design_image(path):
    from PIL import Image, UnidentifiedImageError

    if not path.is_file() or not 0 < path.stat().st_size <= 30 * 1024 * 1024:
        raise DomainError("invalid_image_response", "设计图文件大小需大于0且不超过30MB")
    try:
        with Image.open(path) as image:
            width, height = image.size
            format_ = image.format
            if width < 1280 or height < 720 or max(width, height) > 8192 or width * height > 64_000_000:
                raise DomainError("invalid_image_dimensions", "设计图需至少1280×720、单边不超过8192且总像素不超过6400万")
            if format_ not in {"PNG", "JPEG", "WEBP"} or getattr(image, "n_frames", 1) != 1:
                raise DomainError("invalid_image_response", "设计图需要静态PNG、JPEG或WEBP")
            image.verify()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise DomainError("invalid_image_response", "设计图文件未通过图像校验") from exc
    return path.read_bytes(), {"width": width, "height": height, "format": format_}, abs(width / height - 16 / 9) <= 0.005
