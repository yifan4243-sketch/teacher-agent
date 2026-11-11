"""Audience-specific reviewed exam exports with profile ownership and integrity checks."""

import hashlib
from pathlib import Path

from .database import audit, new_id
from . import exam_print
from .exams import get_paper
from .files import file_root, store_bytes
from .models import DomainError
from .records import get_record


def _checked(result):
    path = Path(result["stored_path"])
    if not path.resolve().is_relative_to(file_root().resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != result["sha256"]:
        raise DomainError("file_integrity_error", "试卷导出文件未通过归属及哈希校验")
    return result


def export(conn, data, actor):
    paper = get_paper(conn, data)
    if paper["status"] != "approved":
        raise DomainError("review_required", "请先审核试卷使用的题目和试卷版本，再导出正式试卷")
    cached = conn.execute("SELECT * FROM exam_exports WHERE paper_id=? AND audience=? AND format=?", (data.id, data.audience, data.format)).fetchone()
    if cached:
        return _checked(dict(cached))
    course = get_record(conn, "course", paper["plan"]["course_id"])
    content = exam_print.print_content(paper, data.audience, course["title"])
    output = exam_print.build(content, data.format)
    path, digest = store_bytes(output, "." + data.format)
    identifier = new_id()
    filename = f"试卷-{'学生版' if data.audience == 'student' else '教师版'}-v{paper['version']}.{data.format}"
    conn.execute("""INSERT INTO exam_exports(id,paper_id,audience,format,stored_path,sha256,byte_size,filename)
        VALUES(?,?,?,?,?,?,?,?)""", (identifier, data.id, data.audience, data.format, str(path), digest, len(output), filename))
    result = dict(conn.execute("SELECT * FROM exam_exports WHERE id=?", (identifier,)).fetchone())
    audit(conn, "exam_paper", data.id, "export_" + data.audience + "_" + data.format, actor, None, result)
    return result


def download(conn, data):
    row = conn.execute("SELECT * FROM exam_exports WHERE id=?", (data.id,)).fetchone()
    if row is None:
        raise DomainError("not_found", "试卷导出文件不存在")
    result = _checked(dict(row))
    return {key: result[key] for key in ("stored_path", "filename", "sha256")}
