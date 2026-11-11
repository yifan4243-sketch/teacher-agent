"""Deterministic, editable teaching cards using only reviewed blueprint text."""

from math import ceil
import unicodedata

from .blueprint_models import SlideBlueprint
from .blueprints import THEMES
from .documents import get_document
from .models import DomainError
from .slides import SlideLayout


def _lines(text, width, font):
    units = sum(1 if unicodedata.east_asian_width(char) in ("W", "F") else 0.6 for char in text)
    return max(1, ceil(units * font / width))


def page_layout(blueprint, page):
    dark = blueprint.theme in ("technology", "dark")
    foreground, accent, card = ("F1F5F9", "38BDF8", "17253B") if dark else ("102044", "175CBA", "EFF6FF")
    elements = [
        {"kind": "shape", "name": "accent", "x": 80, "y": 70, "width": 12, "height": 140,
         "shape": "rectangle", "fill": accent},
        {"kind": "text", "name": "title", "x": 120, "y": 70, "width": 1400, "height": 155,
         "text": page.title, "font_size": 48, "color": foreground, "bold": True},
    ]
    weights = [_lines(text, 1320, 34) + 1 for text in page.key_messages]
    available = 530 - 12 * (len(weights) - 1)
    y = 255
    for index, (text, weight) in enumerate(zip(page.key_messages, weights)):
        height = available * weight / sum(weights)
        elements.extend([
            {"kind": "shape", "name": f"card-{index}", "x": 80, "y": y, "width": 1440, "height": height,
             "shape": "rounded_rectangle", "fill": card},
            {"kind": "text", "name": f"message-{index}", "x": 120, "y": y + 8, "width": 1360, "height": height - 16,
             "text": text, "font_size": 34, "color": foreground},
        ])
        y += height + 12
    elements.append({"kind": "text", "name": "page-number", "x": 80, "y": 825, "width": 1440, "height": 40,
                     "text": f"第{page.unit_index + 1}教学单元 · 第{page.number}页 · {page.duration_minutes:g}分钟", "font_size": 28, "color": accent})
    return SlideLayout.model_validate({"title": page.title, "width": 1600, "height": 900,
                                      "background": THEMES[blueprint.theme]["background"], "elements": elements})


def create_deck(conn, data, actor):
    from .reconstruction import _save_page

    document = get_document(conn, data)
    if document["kind"] != "slide_blueprint" or document["status"] != "approved":
        raise DomainError("review_required", "结构化课件需要已审核的页面蓝图")
    blueprint = SlideBlueprint.model_validate(document["content"])
    versions = dict(conn.execute("SELECT page_number,MAX(version) FROM slide_pages WHERE blueprint_id=? GROUP BY page_number", (data.id,)).fetchall())
    pages = [_save_page(conn, data.id, page.number, versions.get(page.number, 0), None, None,
                        page_layout(blueprint, page), actor, source_mode="blueprint") for page in blueprint.pages]
    return {"blueprint_id": data.id, "source_mode": "blueprint", "items": pages}
