"""Windows entry selecting the owning profile's existing PM environment on each run."""

import json
import logging
from logging.handlers import RotatingFileHandler
import os
from pathlib import Path
import subprocess
import sys
import time


def main():
    binding = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    os.environ["HERMES_HOME"] = binding["home"]
    os.environ["HERMES_RUNTIME_DIR"] = binding["runtime"]
    core = Path(binding["core"])
    logs = Path(binding["home"]) / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    handler = RotatingFileHandler(logs / "teacher-reminder-background.log", maxBytes=1000000, backupCount=2, encoding="utf-8")
    logging.basicConfig(handlers=[handler], level=logging.INFO)
    try:
        started = time.monotonic()
        # Use the same activation command as activate.ps1. Its JSON is kept in
        # process memory because the composed environment can include secrets.
        environment = {**os.environ, "PYTHONPATH": str(core), "PYTHONUTF8": "1", "HERMES_DISABLE_LAZY_INSTALLS": "1"}
        activation = subprocess.run([sys.executable, "-m", "pm.environments"], cwd=core, env=environment,
            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30, check=True,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        environment.update(json.loads(activation.stdout))
        result = subprocess.run([sys.executable, "-m", "hermes_cli.main", "cron", "tick"],
            cwd=core, env=environment, timeout=180, check=False, capture_output=True, text=True, encoding="utf-8", errors="replace",
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
        logging.info("Native cron tick returned %s in %.2fs\n%s\n%s", result.returncode, time.monotonic() - started, result.stdout[-20000:], result.stderr[-20000:])
    except Exception:
        logging.exception("Native cron tick could not start")
        raise SystemExit(1)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()
