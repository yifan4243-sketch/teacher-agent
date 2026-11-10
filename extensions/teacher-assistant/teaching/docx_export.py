"""Export only DOCX, retaining the supplied lesson-plan table and page geometry."""

from copy import deepcopy
import hashlib
from io import BytesIO
from pathlib import Path


RESOURCE_ROOT = Path(__file__).resolve().parents[1] / "resources"


def _run_font(run, name="宋体", size=12):
    from docx.oxml.ns import qn
    from docx.shared import Pt

    run.font.name = name
    run.font.size = Pt(size)
    run._element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), name)


def _source_text(segment, lesson):
    sources = {source["id"]: source for source in lesson["sources"]}
    return " / ".join(f"{sources[key]['filename']} · v{sources[key]['version']} · {sources[key]['locator']} · 来源ID {key}" for key in segment["source_ids"])


def _script(document, lesson):
    from docx import Document
    from docx.oxml import OxmlElement
    from docx.oxml.ns import qn
    from docx.shared import Cm, Pt
    from docx.shared import RGBColor

    result = Document()
    section = result.sections[0]
    section.page_width, section.page_height = Cm(21), Cm(29.7)
    section.top_margin = section.bottom_margin = Cm(2)
    section.left_margin = section.right_margin = Cm(2.3)
    for style_name in ("Normal", "Title", "Heading 1", "Heading 2"):
        style = result.styles[style_name]
        style.font.name = "宋体"
        style.font.size = Pt(12 if style_name == "Normal" else 16)
        style.font.color.rgb = RGBColor(0, 0, 0)
        style.font.underline = False
        style.element.get_or_add_rPr().rFonts.set(qn("w:eastAsia"), "宋体")
        borders = OxmlElement("w:pBdr")
        for edge in ("top", "left", "bottom", "right", "between", "bar"):
            border = OxmlElement("w:" + edge)
            border.set(qn("w:val"), "nil")
            borders.append(border)
        properties = style.element.get_or_add_pPr()
        previous = properties.find(qn("w:pBdr"))
        if previous is not None:
            properties.remove(previous)
        properties.append(borders)
    result.styles["Normal"].paragraph_format.line_spacing = 1.35
    content = document["content"]
    result.add_paragraph(content["title"], "Title")
    result.add_paragraph(f"授课逐字稿 · 教师已审核 · 版本{document['version']} · 课次 {lesson['id']}")
    result.add_paragraph("第一教学单元40分钟，课间休息10分钟，第二教学单元40分钟。实际教学80分钟，日历跨度90分钟。")
    for unit_index, unit in enumerate(content["units"]):
        if unit_index:
            result.add_heading("课间休息10分钟", 1)
            result.add_paragraph("第40—50分钟为课间休息，不安排讲授、板书或课堂互动。")
            result.add_page_break()
        result.add_heading(f"第{unit_index + 1}教学单元 {unit['title']} 40分钟", 1)
        elapsed = 0 if unit_index == 0 else 50
        for segment in unit["segments"]:
            result.add_heading(f"{segment['title']} 第{elapsed}—{elapsed + segment['minutes']}分钟", 2)
            elapsed += segment["minutes"]
            for paragraph in segment["spoken_text"].splitlines():
                if paragraph.strip():
                    result.add_paragraph(paragraph)
            if segment["teacher_actions"]:
                result.add_paragraph("教师动作", "Heading 2")
                for action in segment["teacher_actions"]:
                    result.add_paragraph(action)
            if segment["student_activity"]:
                result.add_paragraph(f"学生活动 {segment['activity_minutes']:g}分钟", "Heading 2")
                result.add_paragraph(segment["student_activity"])
            if segment["blackboard"]:
                result.add_paragraph("板书", "Heading 2")
                result.add_paragraph(segment["blackboard"])
            citation = result.add_paragraph("教材依据 " + _source_text(segment, lesson))
            for run in citation.runs:
                _run_font(run, size=9)
    result.add_heading("课后作业", 1)
    for homework in content["homework"]:
        result.add_paragraph(homework, "List Number")
    return result


def _set_cell(cell, text):
    paragraph = cell.paragraphs[0]
    properties = deepcopy(paragraph._p.pPr)
    paragraph.clear()
    for old in list(cell.paragraphs)[1:]:
        cell._tc.remove(old._p)
    for index, line in enumerate(text.splitlines()):
        current = paragraph if index == 0 else cell.add_paragraph()
        if index and properties is not None:
            current._p.insert(0, deepcopy(properties))
        current.paragraph_format.keep_with_next = False
        current.paragraph_format.keep_together = False
        _run_font(current.add_run(line))


def _activity_text(content, script):
    activities = {(activity["unit_index"], activity["segment_index"]): activity for activity in content["activities"]}
    lines = []
    for unit_index, unit in enumerate(script["content"]["units"]):
        if unit_index:
            lines.append("课间休息10分钟，不计入教学活动时长。")
        lines.append(f"第{unit_index + 1}教学单元 {unit['title']} 40分钟")
        for segment_index, segment in enumerate(unit["segments"]):
            activity = activities[(unit_index, segment_index)]
            lines.extend((f"{segment['title']}（{segment['minutes']}分钟）", "教师活动 " + activity["teacher_activity"],
                          "学生活动 " + activity["student_activity"], "教学方法 " + activity["methods"]))
    return "\n".join(lines)


def _plan(document, lesson, script):
    from docx import Document
    from docx.enum.table import WD_ROW_HEIGHT_RULE

    template = RESOURCE_ROOT / "templates" / "教案模板（新）.docx"
    template_bytes = template.read_bytes()
    result = Document(BytesIO(template_bytes))
    content = document["content"]
    if result.paragraphs[0].runs:
        result.paragraphs[0].runs[0].text = "教案"
        for run in result.paragraphs[0].runs[1:]:
            run.text = ""
    result.paragraphs[1].text = f"预授课周 {content['teaching_week']} （第{content['session_number']}次课）"
    values = {
        0: content["title"], 1: "40分钟教学＋10分钟休息＋40分钟教学，实际教学80分钟，日历跨度90分钟",
        2: f"本课程第 {content['lesson_numbers']} 课时，总课时 {content['total_lessons'] or '待设置'} 课时",
        3: content["objectives"], 4: content["key_points"], 5: content["difficulties"],
        7: "课前完成，不计入80分钟教学。\n" + content["preparation"],
        8: _activity_text(content, script),
        9: content["summary"] + "\n总结、巩固与作业环节已包含在两个教学单元的80分钟分配内。",
        10: content["values_education"], 11: content["homework"], 12: content["blackboard"],
        13: "课后由教师根据真实课堂情况填写。",
    }
    table = result.tables[0]
    for row_index, text in values.items():
        _set_cell(table.cell(row_index, 1), text)
        # Exact 10mm template rows clip real prose. Retain the minimum size and allow continuation pages.
        table.rows[row_index].height_rule = WD_ROW_HEIGHT_RULE.AT_LEAST
    footer = result.sections[0].footer.paragraphs[0]
    footer.add_run(f"教案v{document['version']} · 授课稿v{script['version']} · 教师已审核")
    return result, hashlib.sha256(template_bytes).hexdigest()


def build_docx(document, lesson, script=None):
    template_hash = None
    if document["kind"] == "script":
        result = _script(document, lesson)
    else:
        result, template_hash = _plan(document, lesson, script)
    stream = BytesIO()
    result.save(stream)
    return stream.getvalue(), template_hash
