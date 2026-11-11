"""Student documents are built from a positive projection of visible question fields."""

from html import escape
from io import BytesIO
import re


KINDS = {"single_choice": "单选题", "multiple_choice": "多选题", "true_false": "判断题", "fill_blank": "填空题", "short_answer": "简答题"}


def _points(value):
    return f"{value / 100:.2f}".rstrip("0").rstrip(".")


def _answer(content):
    if content["kind"] in {"single_choice", "multiple_choice"}:
        return "、".join(content["answer_ids"])
    if content["kind"] == "true_false":
        return "正确" if content["answer"] else "错误"
    if content["kind"] == "fill_blank":
        return "\n".join(f"第{index}空　" + " 或 ".join(blank["accepted"]) for index, blank in enumerate(content["blanks"], 1))
    return content["reference_answer"]


def print_content(paper, audience, course_title):
    config = paper["plan"]["config"]
    result = {"title": paper["title"], "metadata": f"{course_title}　{'学生版' if audience == 'student' else '教师版'}　试卷版本{paper['version']}",
        "instructions": f"满分{_points(config['total_points_centi'])}分　考试时间{config['duration_minutes']}分钟　共{len(paper['questions'])}题",
        "questions": []}
    for index, question in enumerate(paper["questions"], 1):
        content = question["content"]
        item = {"heading": f"{index}　{KINDS[content['kind']]}　{_points(content['points_centi'])}分",
                "prompt": re.sub(r"\{\{[0-9]+\}\}", "________", content["prompt"]),
                "options": [option["id"] + "　" + option["text"] for option in content.get("options", [])],
                "answer_lines": 5 if content["kind"] == "short_answer" else 1}
        if audience == "teacher":
            item["teacher"] = {"answer": _answer(content), "explanation": content["explanation"],
                "rubric": [entry["label"] + f"　{_points(entry['points_centi'])}分" for entry in content.get("rubric", [])],
                "sources": [source["locator"] for source in question["sources"]], "question_version": question["version"]}
        result["questions"].append(item)
    return result


def _paragraphs(item):
    yield item["prompt"]
    yield from item["options"]
    if "teacher" in item:
        teacher = item["teacher"]
        yield "参考答案　" + teacher["answer"]
        yield "解析　" + teacher["explanation"]
        yield from ("评分要点　" + rubric for rubric in teacher["rubric"])
        yield "教材依据　" + "、".join(teacher["sources"]) + f"　题目版本{teacher['question_version']}"
    else:
        yield from ["________________________________________________________________"] * item["answer_lines"]


def _docx(content):
    from docx import Document
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt, RGBColor

    document = Document()
    section = document.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(2)
    section.left_margin = section.right_margin = Cm(2.2)
    for name, size in (("Normal", 11), ("Title", 20), ("Heading 2", 12)):
        style = document.styles[name]
        style.font.name, style.font.size, style.font.color.rgb = "宋体", Pt(size), RGBColor(0, 0, 0)
        style.element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "宋体")
        style.paragraph_format.space_after = Pt(7)
        style.paragraph_format.line_spacing = 1.3
        borders = OxmlElement("w:pBdr")
        for edge in ("top", "left", "bottom", "right", "between", "bar"):
            border = OxmlElement("w:" + edge)
            border.set(qn("w:val"), "nil")
            borders.append(border)
        style.element.get_or_add_pPr().append(borders)
    document.add_paragraph(content["title"], "Title")
    document.add_paragraph(content["metadata"])
    document.add_paragraph(content["instructions"])
    document.add_paragraph("班级________________　姓名________________　学号________________")
    for item in content["questions"]:
        document.add_paragraph(item["heading"], "Heading 2")
        for text in _paragraphs(item):
            document.add_paragraph(text)
    footer = section.footer.paragraphs[0]
    footer.alignment = 1
    footer.add_run("第 ")
    field = OxmlElement("w:fldSimple")
    field.set(qn("w:instr"), "PAGE")
    footer._p.append(field)
    footer.add_run(" 页")
    output = BytesIO()
    document.save(output)
    return output.getvalue()


def _pdf(content):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.cidfonts import UnicodeCIDFont
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    font = "STSong-Light"
    if font not in pdfmetrics.getRegisteredFontNames():
        pdfmetrics.registerFont(UnicodeCIDFont(font))
    body = ParagraphStyle("ExamBody", fontName=font, fontSize=11, leading=17, wordWrap="CJK", spaceAfter=7)
    title = ParagraphStyle("ExamTitle", parent=body, fontSize=20, leading=26, spaceAfter=15)
    heading = ParagraphStyle("ExamQuestion", parent=body, fontSize=12, leading=18, spaceBefore=10, keepWithNext=True)
    def paragraph(text, style=body):
        return Paragraph(escape(text).replace("\n", "<br/>"), style)
    flow = [paragraph(content["title"], title), paragraph(content["metadata"]), paragraph(content["instructions"]),
            paragraph("班级________________　姓名________________　学号________________"), Spacer(1, 10)]
    for item in content["questions"]:
        flow.append(paragraph(item["heading"], heading))
        flow.extend(paragraph(text) for text in _paragraphs(item))
    def footer(canvas, document):
        canvas.setFont(font, 9)
        canvas.drawCentredString(A4[0] / 2, 27, f"第 {document.page} 页")
    output = BytesIO()
    SimpleDocTemplate(output, pagesize=A4, leftMargin=55, rightMargin=55, topMargin=50, bottomMargin=45).build(flow, onFirstPage=footer, onLaterPages=footer)
    return output.getvalue()


def build(content, format_):
    return {"docx": _docx, "pdf": _pdf}[format_](content)
