"""Use the owning Windows user's notification identity and the real WinRT toast API."""

import hashlib
import json
from pathlib import Path
import subprocess
import tempfile

from hermes_constants import get_hermes_home
from hermes_platform import resolver

from .database import encode
from .files import file_root
from .models import DomainError


def application_id():
    identity = hashlib.sha256(str(get_hermes_home().resolve()).casefold().encode()).hexdigest()[:16]
    return "TeacherAgentPro.Reminders." + identity


def run_request(request):
    resolution = resolver.locate_command("powershell.exe")
    if not resolution.found:
        raise DomainError("notification_host_unavailable", "本机没有可用的Windows PowerShell通知接口")
    script = Path(__file__).resolve().parents[1] / "scripts/windows_notify.ps1"
    with tempfile.TemporaryDirectory(prefix=".teacher-notify-", dir=file_root()) as folder:
        path = Path(folder) / "request.json"
        path.write_text(encode({**request, "application_id": application_id()}), encoding="utf-8")
        try:
            result = subprocess.run([*resolution.command, "-NoProfile", "-NonInteractive", "-File", str(script), "-RequestPath", str(path)],
                capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30, check=False,
                creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        except subprocess.TimeoutExpired as exc:
            raise DomainError("notification_timeout", "Windows通知请求超时，请查看提醒记录后重试") from exc
    try:
        response = json.loads(result.stdout.lstrip("\ufeff").strip())
    except ValueError as exc:
        raise DomainError("notification_response_invalid", "Windows通知未返回有效结果，请查看运行日志") from exc
    if not isinstance(response, dict) or response.get("ok") is not True or result.returncode:
        code = response.get("error") if isinstance(response, dict) else None
        if code == "notification_disabled":
            raise DomainError(code, "Windows已关闭此应用的通知，请在系统通知设置中启用")
        raise DomainError("notification_failed", "Windows未能接受通知，请查看本机通知设置和提醒记录")
    return response


def notify(title, body, identifier):
    return run_request({"action": "notify", "title": title[:120], "body": body[:600], "tag": identifier.replace("-", "")[:16]})


def probe(conn, data):
    return run_request({"action": "probe"})


def test_notification(conn, data, actor):
    from .database import new_id
    return notify("Teacher Agent Pro 测试通知", "本机教学提醒接口测试。", new_id())
