"""Immutable content-addressed files under the owning Hermes profile."""

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
