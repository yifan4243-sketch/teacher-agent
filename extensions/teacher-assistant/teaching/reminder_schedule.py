"""Profile-owned native no-agent cron, triggered by the current Windows user's task."""

import hashlib
from contextlib import contextmanager
import json
import logging
import os
import sqlite3
from pathlib import Path
import subprocess
import sys
import tempfile

import hermes_constants
from hermes_constants import get_hermes_home
from hermes_platform import resolver
from tools.registry import discover_builtin_tools, registry
from plugins.plugin_storage import plugin_db

from .database import audit, database, encode, new_id
from .files import file_root
from .models import DomainError


logger = logging.getLogger(__name__)


@contextmanager
def configuration_lock():
    # Native discovery and OS registration can take longer than a teaching write.
    # Keep their cross-process serialization independent of the teaching database.
    conn = plugin_db("teacher-assistant", "reminder-configuration.db")
    try:
        conn.execute("PRAGMA busy_timeout=120000")
        try:
            conn.execute("BEGIN IMMEDIATE")
        except sqlite3.OperationalError as exc:
            if exc.sqlite_errorcode in {sqlite3.SQLITE_BUSY, sqlite3.SQLITE_LOCKED}:
                raise DomainError("background_configuration_busy", "另一项后台配置正在运行，请稍后刷新状态") from exc
            raise
        yield
    finally:
        conn.close()


def identity():
    home = get_hermes_home().resolve()
    digest = hashlib.sha256(str(home).casefold().encode()).hexdigest()[:16]
    return {"name": "TeacherAgentPro-" + digest, "description": "Teacher Agent Pro reminders for " + str(home)}


def cron_call(**args):
    discover_builtin_tools()
    result = registry.dispatch("cronjob_manage", args)
    if isinstance(result, str):
        result = json.loads(result)
    if result.get("success") is not True:
        logger.error("Reminder cron action %s failed: %s", args.get("action"), result.get("error"))
        raise DomainError("reminder_cron_failed", "Hermes定时任务未能完成操作，请查看后台状态")
    return result


def write_owned(folder, stem, content, suffix):
    folder.mkdir(parents=True, exist_ok=True)
    digest = hashlib.sha256(content).hexdigest()[:20]
    path = folder / (stem + "-" + digest + suffix)
    for existing in sorted(folder.glob(stem + "-" + digest + "*" + suffix)):
        if existing.is_file() and existing.read_bytes() == content:
            return existing
    try:
        with path.open("xb") as stream:
            stream.write(content)
    except FileExistsError:
        if path.read_bytes() != content:
            path = folder / (stem + "-" + digest + "-" + new_id() + suffix)
            with path.open("xb") as stream:
                stream.write(content)
    return path


def windows_task(action, **extra):
    resolution = resolver.locate_command("powershell.exe")
    if not resolution.found:
        raise DomainError("background_host_unavailable", "本机没有可用的Windows后台任务接口")
    script = Path(__file__).resolve().parents[1] / "scripts/windows_background.ps1"
    with tempfile.TemporaryDirectory(prefix=".teacher-background-", dir=file_root()) as folder:
        request = Path(folder) / "request.json"
        request.write_text(encode({**identity(), "action": action, **extra}), encoding="utf-8")
        try:
            result = subprocess.run([*resolution.command, "-NoProfile", "-NonInteractive", "-File", str(script), "-RequestPath", str(request)],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30, check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except subprocess.TimeoutExpired as exc:
            raise DomainError("background_task_timeout", "Windows后台配置超时，请刷新后台状态") from exc
    try:
        response = json.loads(result.stdout.lstrip("\ufeff").strip())
    except ValueError as exc:
        raise DomainError("background_response_invalid", "Windows后台任务返回无效结果") from exc
    if result.returncode or not isinstance(response, dict) or response.get("ok") is not True:
        logger.error("Windows reminder task %s failed: %s", action, response)
        raise DomainError("background_task_failed", "Windows后台任务操作失败，请检查当前用户的任务计划权限")
    return response


def status(conn, data):
    stored = dict(conn.execute("SELECT cron_job_id,background_task_name,last_tick_at,last_tick_error FROM reminder_settings WHERE id=1").fetchone())
    task = windows_task("status")
    jobs = cron_call(action="list")["jobs"]
    stored["windows"] = task
    stored["cron"] = next((job for job in jobs if job["job_id"] == stored["cron_job_id"]), None)
    return stored


def install(*, data, actor, request_id, session_id=None):
    if not request_id or len(request_id) > 128:
        raise DomainError("invalid_request_id", "后台配置需要有效的request_id")
    with configuration_lock():
        return _install(actor)


def _install(actor):
    home = get_hermes_home().resolve()
    plugin = Path(__file__).resolve().parents[1]
    binding = {"home": str(home), "plugin": str(plugin)}
    source = (plugin / "scripts/reminder_tick.py").read_text(encoding="utf-8")
    script = write_owned(home / "scripts", "teacher-reminder", ("BINDING = " + repr(binding) + "\n" + source).encode(), ".py")
    name = identity()["name"]
    jobs = cron_call(action="list")["jobs"]
    with database() as conn:
        stored_id = conn.execute("SELECT cron_job_id FROM reminder_settings WHERE id=1").fetchone()[0]
    job = next((job for job in jobs if job["name"] == name and job.get("no_agent")
        and (job["job_id"] == stored_id or job.get("script") == script.name)), None)
    if job is None:
        job_id = cron_call(action="create", name=name, schedule="every 1m", script=script.name, no_agent=True,
            deliver="local", failure_deliver="local", timezone="Asia/Shanghai")["job_id"]
    else:
        job_id = job["job_id"]
        if job.get("script") != script.name:
            cron_call(action="update", job_id=job_id, script=script.name)
        if not job["enabled"]:
            cron_call(action="resume", job_id=job_id)
    with database() as conn:
        conn.execute("BEGIN IMMEDIATE")
        conn.execute("UPDATE reminder_settings SET cron_job_id=?,background_task_name=? WHERE id=1", (job_id, name))
    core = Path(hermes_constants.__file__).resolve().parent
    runtime = os.environ.get("HERMES_RUNTIME_DIR", "")
    config = write_owned(home / "scripts", "teacher-background", encode({**binding, "core": str(core), "runtime": runtime}).encode(), ".json")
    python = Path(sys.executable)
    hidden = python.with_name("pythonw.exe")
    executable = str(hidden if hidden.is_file() else python)
    arguments = subprocess.list2cmdline([str(plugin / "scripts/background_tick.py"), str(config)])
    response = windows_task("install", executable=executable, arguments=arguments, workdir=str(core))
    with database() as conn:
        audit(conn, "reminder_settings", "1", "background_install", actor, None, {"cron_job_id": job_id, "windows": response})
    return {"cron_job_id": job_id, "windows": response}


def remove(*, data, actor, request_id, session_id=None):
    if not request_id or len(request_id) > 128:
        raise DomainError("invalid_request_id", "后台配置需要有效的request_id")
    with configuration_lock():
        response = windows_task("remove")
        with database() as conn:
            row = conn.execute("SELECT cron_job_id FROM reminder_settings WHERE id=1").fetchone()
        if row[0]:
            jobs = cron_call(action="list")["jobs"]
            job = next((job for job in jobs if job["job_id"] == row[0] and job["name"] == identity()["name"]), None)
            if job:
                cron_call(action="pause", job_id=job["job_id"])
        with database() as conn:
            conn.execute("BEGIN IMMEDIATE")
            conn.execute("UPDATE reminder_settings SET background_task_name=NULL WHERE id=1")
            audit(conn, "reminder_settings", "1", "background_remove", actor, None, response)
    return response
