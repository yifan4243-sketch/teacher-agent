"""Native Office files and a paginated Chinese PDF share deterministic teaching rows."""

from html import escape
from io import BytesIO
from math import ceil


HEADERS = ("课次", "日期", "时段", "教学内容", "教学与休息安排", "教学分钟", "考核分钟")
KINDS = {"teaching": "教学", "practice": "练习", "review": "复习", "exam": "考核", "assessment": "考核", "break": "休息"}
NOTE = "本文件为指定计划版本，时间为北京时间。实际调课及授课进度以当前课表为准，课间不计入教学分钟。"


def rows(content):
    return [(item["ordinal"], item["starts_at"][:10], item["starts_at"][11:16] + "–" + item["ends_at"][11:16],
             KINDS[item["kind"]] + " " + item["title"],
             "\n".join(f"{KINDS[part['kind']]} {part['start'][11:16]}–{part['end'][11:16]}" for part in item["periods"]),
             item["instruction_minutes"], item["assessment_minutes"]) for item in content["sessions"]]


def labels(content):
    return (f"{content['title']} {content['scope_label']}教学计划",
            f"{content['status']} v{content['version']}　课程 {content['course_title']}　教材 {content['book_title']} v{content['book_version']}",
            f"本范围{len(content['sessions'])}课次　教学{content['instruction_minutes']}分钟　考核{content['assessment_minutes']}分钟　日历{content['calendar_minutes']}分钟")


def _docx(content):
    from docx import Document
    from docx.enum.section import WD_ORIENT
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor
    from .docx_export import _run_font

    document = Document()
    section = document.sections[0]
    section.orientation = WD_ORIENT.LANDSCAPE
    section.page_width, section.page_height = Cm(29.7), Cm(21)
    section.top_margin = section.bottom_margin = Cm(1.4)
    section.left_margin = section.right_margin = Cm(1.5)
    for name, size in (("Normal", 10), ("Title", 18)):
        style = document.styles[name]
        style.font.name, style.font.size, style.font.color.rgb = "宋体", Pt(size), RGBColor(0, 0, 0)
        style.element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "宋体")
        borders = OxmlElement("w:pBdr")
        for edge in ("top", "left", "bottom", "right", "between", "bar"):
            border = OxmlElement("w:" + edge)
            border.set(qn("w:val"), "nil")
            borders.append(border)
        style.element.get_or_add_pPr().append(borders)
    title, metadata, totals = labels(content)
    document.add_paragraph(title, "Title")
    for text in (metadata, totals, NOTE):
        document.add_paragraph(text)
    table = document.add_table(rows=1, cols=len(HEADERS))
    table.style, table.autofit = "Table Grid", False
    widths = (1.2, 2.2, 2.4, 6.6, 8.9, 2, 2)
    for column, width in zip(table.columns, widths):
        column.width = Cm(width)
    table.rows[0]._tr.get_or_add_trPr().append(OxmlElement("w:tblHeader"))
    for index, values in enumerate([HEADERS, *rows(content)]):
        row = table.rows[0] if index == 0 else table.add_row()
        row._tr.get_or_add_trPr().append(OxmlElement("w:cantSplit"))
        for cell, value, width in zip(row.cells, values, widths):
            cell.text, cell.width = str(value), Cm(width)
            for paragraph in cell.paragraphs:
                paragraph.paragraph_format.space_after, paragraph.paragraph_format.line_spacing = Pt(0), 1.1
                for run in paragraph.runs:
                    _run_font(run, size=9.5)
                    run.bold = index == 0
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def _xlsx(content):
    from openpyxl import Workbook
    from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
    from openpyxl.utils import get_column_letter

    book = Workbook()
    sheet = book.active
    sheet.title = "教学计划"
    for index, value in enumerate((*labels(content), NOTE), 1):
        sheet.merge_cells(start_row=index, start_column=1, end_row=index, end_column=7)
        cell = sheet.cell(index, 1, value)
        cell.data_type = "s"
        cell.font = Font(name="Microsoft YaHei", size=16 if index == 1 else 10, bold=index == 1)
        cell.alignment = Alignment(vertical="center", wrap_text=True)
        line_height, capacity = (22, 40) if index == 1 else (14, 65)
        sheet.row_dimensions[index].height = max(35 if index <= 2 else 30, ceil(len(value) / capacity) * line_height + 6)
    side = Side(style="thin", color="DCE3EB")
    for row_number, values in enumerate([HEADERS, *rows(content)], 5):
        for column, value in enumerate(values, 1):
            cell = sheet.cell(row_number, column, value)
            if isinstance(value, str):
                cell.data_type = "s"
            cell.font = Font(name="Microsoft YaHei", size=10, bold=row_number == 5, color="FFFFFF" if row_number == 5 else "182435")
            cell.fill = PatternFill("solid", fgColor="244A73" if row_number == 5 else "F2F5F9" if row_number % 2 == 0 else "FFFFFF")
            cell.border = Border(left=side, right=side, top=side, bottom=side)
            cell.alignment = Alignment(horizontal="left" if column in (4, 5) else "center", vertical="center", wrap_text=True)
        sheet.row_dimensions[row_number].height = 30 if row_number == 5 else max(54, ceil(len(str(values[3])) / 18) * 15)
    for column, width in enumerate((7, 16, 18, 40, 32, 13, 13), 1):
        sheet.column_dimensions[get_column_letter(column)].width = width
    sheet.freeze_panes, sheet.auto_filter.ref = "A6", f"A5:G{sheet.max_row}"
    sheet.sheet_view.showGridLines = False
    sheet.print_title_rows, sheet.print_area = "1:5", f"A1:G{sheet.max_row}"
    sheet.sheet_properties.pageSetUpPr.fitToPage = True
    sheet.page_setup.orientation, sheet.page_setup.paperSize = "landscape", sheet.PAPERSIZE_A4
    sheet.page_setup.fitToWidth, sheet.page_setup.fitToHeight = 1, 0
    output = BytesIO()
    book.save(output)
    return output.getvalue()


def _pdf(content):
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4, landscape
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.platypus import LongTable, Paragraph, SimpleDocTemplate, Spacer, TableStyle

    font = "STSong-Light"
    if font not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(UnicodeCIDFont(font))
    body = ParagraphStyle("TeacherPlanBody", fontName=font, fontSize=9, leading=12, wordWrap="CJK")
    heading = ParagraphStyle("TeacherPlanTitle", parent=body, fontSize=18, leading=23, spaceAfter=12)
    title, metadata, totals = labels(content)
    flow = [Paragraph(escape(title), heading)]
    for text in (metadata, totals, NOTE):
        flow.extend([Paragraph(escape(text), body), Spacer(1, 7)])
    values = [[Paragraph(escape(str(value)).replace("\n", "<br/>"), body) for value in row] for row in [HEADERS, *rows(content)]]
    table = LongTable(values, colWidths=(30, 66, 70, 195, 300, 55, 55), repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#E1EAF3")),
        ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#CAD3DF")), ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 4), ("BOTTOMPADDING", (0, 0), (-1, -1), 4)]))
    flow.append(table)
    output = BytesIO()
    document = SimpleDocTemplate(output, pagesize=landscape(A4), leftMargin=32, rightMargin=32, topMargin=30, bottomMargin=30)
    document.build(flow)
    return output.getvalue()


def build(content, format_):
    return {"docx": _docx, "xlsx": _xlsx, "pdf": _pdf}[format_](content)
