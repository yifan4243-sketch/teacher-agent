"""Build the early native-object prototype from a reviewed layout of an AI design image."""

import argparse
import importlib.util
import json
from pathlib import Path
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--layout", type=Path, required=True)
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1] / "teaching"
    spec = importlib.util.spec_from_file_location("teacher_slide_prototype", root / "__init__.py", submodule_search_locations=[str(root)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    from teacher_slide_prototype.slides import export_pptx

    layout = json.loads(args.layout.read_text(encoding="utf-8"))
    export_pptx([layout], args.out)
    print(json.dumps({"output": str(args.out), "objects": len(layout["elements"]),
                      "layout_origin": "AI-generated input image, layout measured and reviewed by developer", "whole_page_bitmap": False}))


if __name__ == "__main__":
    main()
