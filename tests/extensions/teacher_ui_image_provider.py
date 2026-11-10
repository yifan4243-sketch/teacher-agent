"""Offline image provider installed only in an isolated Desktop integration home."""

import json
from pathlib import Path
import shutil
from uuid import uuid4

from agent.image_gen_provider import ImageGenProvider, success_response
from hermes_constants import get_hermes_home


class FixtureImageProvider(ImageGenProvider):
    name = "teacher-ui-image"

    def generate(self, prompt, aspect_ratio="landscape", **kwargs):
        home = get_hermes_home()
        folder = home / "cache/generated/images"
        folder.mkdir(parents=True, exist_ok=True)
        image = folder / (str(uuid4()) + ".jpg")
        shutil.copy2(Path(__file__).parent / "fixture.jpg", image)
        with (home / "image-fixture-calls.jsonl").open("a", encoding="utf-8") as stream:
            stream.write(json.dumps({"prompt": prompt, "image": str(image)}, ensure_ascii=False) + "\n")
        return success_response(image=str(image), model="offline-fixture", prompt=prompt,
                                aspect_ratio=aspect_ratio, provider=self.name, extra={"cost_usd": "0.01"})


def register(ctx):
    ctx.register_image_gen_provider(FixtureImageProvider())
