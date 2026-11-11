"""Run by Hermes no-agent cron with a profile binding prepended at installation."""

import importlib
import importlib.util
import json
from pathlib import Path
import sys

from hermes_constants import get_hermes_home
from hermes_cli.config import load_config


def main(binding):
    if get_hermes_home().resolve() != Path(binding["home"]).resolve():
        raise RuntimeError("Reminder profile binding does not match the active Hermes home")
    plugins = load_config().get("plugins", {})
    if "teacher-assistant" not in plugins.get("enabled", []) or "teacher-assistant" in plugins.get("disabled", []):
        print(json.dumps({"enabled": False, "reason": "plugin_disabled"}))
        return
    root = Path(binding["plugin"])
    name = "teacher_reminder_runtime"
    spec = importlib.util.spec_from_file_location(name, root / "__init__.py", submodule_search_locations=[str(root)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    reminders = importlib.import_module(name + ".teaching.reminders")
    print(json.dumps(reminders.tick(), ensure_ascii=False))


if __name__ == "__main__":
    main(globals()["BINDING"])
