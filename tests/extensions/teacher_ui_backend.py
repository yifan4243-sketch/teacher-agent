"""Loopback-only model for the teacher Desktop integration tests."""

import json
from pathlib import Path
import sys

from tests.e2e.core.history._helpers import NO_BACKGROUND_REVIEW, OFFLINE_CONFIG
from tests.fakes.fake_llm_provider import FakeLLMServer, write_hermes_home


def main():
    home = Path(sys.argv[1])
    with FakeLLMServer(default_text="本地界面测试模型。") as server:
        write_hermes_home(home, server.base_url, extra_config=OFFLINE_CONFIG + NO_BACKGROUND_REVIEW + "plugins:\n  enabled: [teacher-assistant]\nonboarding:\n  run: false\n")
        print(json.dumps({"ready": True}), flush=True)
        sys.stdin.readline()
        print(json.dumps({"model_requests": len(server.main_requests())}), flush=True)


if __name__ == "__main__":
    main()
