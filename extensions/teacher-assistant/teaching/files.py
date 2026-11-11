"""Immutable content-addressed files under the owning Hermes profile."""

import base64
import binascii
import hashlib
import os
from pathlib import Path
import tempfile

from plugins.plugin_storage import plugin_data_dir

from .models import DomainError


def file_root():
    root = plugin_data_dir("teacher-assistant") / "files"
    root.mkdir(exist_ok=True)
    return root


def check_owned_export(result, label):
    path = Path(result["stored_path"])
    if not path.resolve().is_relative_to(file_root().resolve()) or hashlib.sha256(path.read_bytes()).hexdigest() != result["sha256"]:
        raise DomainError("file_integrity_error", label + "文件未通过归属及哈希校验")
    return result


def store_bytes(data, suffix):
    digest = hashlib.sha256(data).hexdigest()
    destination = file_root() / (digest + suffix)
    stream = tempfile.NamedTemporaryFile(dir=file_root(), prefix=".staging-", delete=False)
    staging = Path(stream.name)
    try:
        with stream:
            stream.write(data)
            stream.flush()
            os.fsync(stream.fileno())
        try:
            os.link(staging, destination)
        except FileExistsError:
            if hashlib.sha256(destination.read_bytes()).hexdigest() != digest:
                raise DomainError("file_integrity_error", "已有教学文件的哈希校验失败") from None
    finally:
        staging.unlink()
    return destination, digest


def upload_path(identifier):
    root = plugin_data_dir("teacher-assistant") / "uploads"
    root.mkdir(exist_ok=True)
    return root / (identifier + ".part")


def write_upload_chunk(row, data):
    if row["status"] != "uploading":
        raise DomainError("invalid_transition", "上传已结束")
    try:
        content = base64.b64decode(data.content_base64, validate=True)
    except (binascii.Error, ValueError):
        raise DomainError("invalid_input", "上传内容不是有效Base64") from None
    if not 0 < len(content) <= 512 * 1024 or data.offset + len(content) > row["total_bytes"]:
        raise DomainError("invalid_file_size", "上传分块大小不正确")
    path = upload_path(row["id"])
    with path.open("r+b") as stream:
        if path.stat().st_size < row["bytes_received"] or data.offset > row["bytes_received"]:
            raise DomainError("upload_conflict", "上传偏移与已保存数据不一致")
        stream.seek(data.offset)
        if data.offset < row["bytes_received"]:
            if data.offset + len(content) > row["bytes_received"] or stream.read(len(content)) != content:
                raise DomainError("upload_conflict", "重复分块的内容不一致")
            return row["bytes_received"]
        stream.write(content)
        stream.truncate()
        stream.flush()
        os.fsync(stream.fileno())
    return row["bytes_received"] + len(content)
