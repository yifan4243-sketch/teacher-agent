"""Source locators describe the file's actual structure, including absent page numbers."""

from dataclasses import dataclass, field, replace
from pathlib import Path
import re
import zipfile

from .models import DomainError


@dataclass
class SourceUnit:
    text: str
    locator: str
    kind: str
    page: int | None = None
    heading_level: int | None = None


@dataclass
class ParsedBook:
    units: list[SourceUnit] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    toc: list[dict] = field(default_factory=list)


def heading_level(text):
    chinese = re.match(r"^第[零〇一二三四五六七八九十百千万\d]+(章|节|篇|单元)\s*\S", text)
    if chinese:
        return 2 if chinese[1] == "节" else 1
    if re.match(r"^(?:Chapter|Unit)\s+\d+\b", text, re.IGNORECASE):
        return 1
    numbered = re.match(r"^(\d+(?:\.\d+){0,3})[\s、.．]\s*\D", text)
    if numbered and len(text) < 160:
        return numbered[1].count(".") + 1
    return None


def _lines(text, locator, kind, page=None):
    units = []
    for index, line in enumerate(text.splitlines(), 1):
        clean = line.strip()
        if clean:
            units.append(SourceUnit(clean, f"{locator}/line:{index}", kind, page, heading_level(clean)))
    return units


def parse_txt(path):
    data = path.read_bytes()
    if data.startswith((b"\xff\xfe", b"\xfe\xff")):
        text = data.decode("utf-16")
    else:
        try:
            text = data.decode("utf-8-sig")
        except UnicodeDecodeError:
            text = data.decode("gb18030")
    return ParsedBook(_lines(text, "text", "line"))


def parse_pdf(path):
    from pypdf import PdfReader

    reader = PdfReader(path)
    if reader.is_encrypted and not reader.decrypt(""):
        raise DomainError("encrypted_textbook", "教材有密码保护，请先提供可读取的副本")
    result = ParsedBook()
    if len(reader.pages) > 5000:
        raise DomainError("textbook_too_large", "单个教材最多支持5000页")
    for index, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        result.units.extend(_lines(text, f"page:{index}", "page", index))
        if not text.strip():
            result.warnings.append(f"第{index}页没有可提取文本，需要OCR或人工补录")
    return result


def parse_docx(path):
    from docx import Document
    from docx.table import Table

    result = ParsedBook()
    document = Document(path)
    if document.inline_shapes:
        result.warnings.append("文档含图片，图片内文字需要OCR或人工核验")
    for index, item in enumerate(document.iter_inner_content(), 1):
        if isinstance(item, Table):
            for row_index, row in enumerate(item.rows, 1):
                seen = set()
                for cell_index, cell in enumerate(row.cells, 1):
                    if cell._tc in seen:
                        continue
                    seen.add(cell._tc)
                    text = cell.text.strip()
                    if text:
                        result.units.append(SourceUnit(text, f"block:{index}/row:{row_index}/cell:{cell_index}", "table_cell"))
            continue
        text = item.text.strip()
        if text:
            style = re.search(r"(?:Heading|标题)\s*(\d+)", item.style.name, re.IGNORECASE)
            level = int(style[1]) if style else heading_level(text)
            result.units.append(SourceUnit(text, f"block:{index}/paragraph", "paragraph", heading_level=level))
    return result


def parse_pptx(path):
    from pptx import Presentation

    result = ParsedBook()
    for slide_index, slide in enumerate(Presentation(path).slides, 1):
        title = slide.shapes.title
        for shape_index, shape in enumerate(slide.shapes, 1):
            locator = f"slide:{slide_index}/shape:{shape_index}"
            if shape.has_text_frame and shape.text.strip():
                result.units.append(SourceUnit(shape.text.strip(), locator, "slide", slide_index,
                                               1 if title is not None and shape.shape_id == title.shape_id else None))
            if shape.has_table:
                for row_index, row in enumerate(shape.table.rows, 1):
                    for cell_index, cell in enumerate(row.cells, 1):
                        if cell.text.strip():
                            result.units.append(SourceUnit(cell.text.strip(), f"{locator}/row:{row_index}/cell:{cell_index}", "table_cell", slide_index))
    return result


PARSERS = {".txt": parse_txt, ".pdf": parse_pdf, ".docx": parse_docx, ".pptx": parse_pptx}


def parse_book(path, suffix):
    from lxml.etree import XMLSyntaxError
    from pypdf.errors import PdfReadError

    try:
        if suffix in {".docx", ".pptx"}:
            with zipfile.ZipFile(path) as archive:
                if sum(item.file_size for item in archive.infolist()) > 200 * 1024 * 1024:
                    raise DomainError("textbook_too_large", "Office文件解压后超过200MB")
        result = PARSERS[suffix](Path(path))
    except (zipfile.BadZipFile, UnicodeError, KeyError, XMLSyntaxError, PdfReadError) as exc:
        raise DomainError("invalid_textbook", "教材文件无法解析，请核对文件格式和内容") from exc
    if not result.units:
        raise DomainError("no_text", "未提取到教材文本，请使用OCR或可检索的教材文件")
    if sum(len(unit.text) for unit in result.units) > 10_000_000:
        raise DomainError("textbook_too_large", "单个教材文本超过1000万字符")
    for unit in result.units:
        toc = re.match(r"^(.+?)(?:\.{2,}|…{2,}|·{2,}|\s{3,})(\d{1,4})$", unit.text)
        if toc:
            result.toc.append({"title": toc[1].strip(), "printed_page_hint": int(toc[2]), "locator": unit.locator, "page_verified": False})
            unit.heading_level = None
    result.units = [part for unit in result.units for part in _chunks(unit)]
    return result


def _chunks(unit):
    if len(unit.text) <= 4000:
        return [unit]
    return [replace(unit, text=unit.text[start:start + 4000], locator=f"{unit.locator}/chars:{start}-{min(start + 4000, len(unit.text))}",
                    heading_level=unit.heading_level if start == 0 else None)
            for start in range(0, len(unit.text), 4000)]
