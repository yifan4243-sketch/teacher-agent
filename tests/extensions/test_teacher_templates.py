"""Real structured PPTX exports, rendering provenance and legacy page migration."""

import hashlib
import importlib
from pathlib import Path
import sqlite3

import pytest

from tests.extensions.test_teacher_blueprints import preparation_fixture
from tests.extensions.test_teacher_foundation import saved, teacher, tool
from tests.extensions.test_teacher_images import image_workspace
from tests.extensions.test_teacher_reconstruction import reconstruction_workspace
from tests.extensions.test_teacher_rendering import render_workspace

__all__ = ["image_workspace", "reconstruction_workspace", "render_workspace", "teacher"]


def test_blueprint_templates_export_native_text_without_model_calls(teacher, tmp_path):
    from pptx import Presentation
    from pptx.enum.shapes import MSO_SHAPE_TYPE

    _, _, call = teacher
    _, _, _, params = preparation_fixture(call, tmp_path)
    blueprint = saved(call, "document.save", params)
    assert call("slide.deck.from_blueprint", {"id": blueprint["id"]}, "unreviewed-blueprint")["error"]["code"] == "review_required"
    saved(call, "document.review", {"id": blueprint["id"], "decision": "approved"})
    response = tool("slide.deck.from_blueprint", {"id": blueprint["id"]}, "templates-once", name="teacher_slides")
    assert response["ok"], response
    pages = response["data"]["items"]
    assert all(page["source_mode"] == "blueprint" and page["asset_id"] is None and page["analysis_id"] is None for page in pages)
    assert tool("slide.deck.from_blueprint", {"id": blueprint["id"]}, "templates-once", name="teacher_slides")["data"]["items"] == pages
    assert call("slide.deck.export", {"id": blueprint["id"]}, "unreviewed-templates")["error"]["code"] == "incomplete_deck"
    for page in pages:
        assert page["text_check"]["missing_text"] == []
        saved(call, "slide.page.review", {"id": page["id"], "decision": "approved", "note": "fixture template review"})
    exported = saved(call, "slide.deck.export", {"id": blueprint["id"]})
    presentation = Presentation(exported["stored_path"])
    assert len(presentation.slides) == len(blueprint["content"]["pages"])
    for slide, source in zip(presentation.slides, blueprint["content"]["pages"]):
        texts = [shape.text for shape in slide.shapes if shape.has_text_frame]
        assert source["title"] in texts and all(message in texts for message in source["key_messages"])
        assert not any(shape.shape_type == MSO_SHAPE_TYPE.PICTURE for shape in slide.shapes)
    newer = saved(call, "slide.deck.from_blueprint", {"id": blueprint["id"]})
    assert all(page["version"] == 2 and page["status"] == "draft" for page in newer["items"])
    assert saved(call, "slide.deck.export", {"id": blueprint["id"]})["sha256"] == exported["sha256"]


def test_template_render_has_no_fake_reference_or_pixel_difference(render_workspace, monkeypatch):
    call, source, adapter, _, _, rendered = render_workspace
    monkeypatch.setattr(adapter, "render", lambda *args: (rendered, {"version": "fixture"}))
    deck = saved(call, "slide.deck.from_blueprint", {"id": source["blueprint_id"]})
    page = deck["items"][0]
    job = saved(call, "slide.render.begin", {"id": page["id"]})
    finished = saved(call, "slide.render.run", {"id": job["id"]}, job["id"])
    assert finished["state"] == "succeeded", finished
    assert finished["comparison"]["reference_sha256"] is None and finished["difference_path"] is None
    assert "mean_absolute_rgb_error" not in finished["comparison"]
    assert call("slide.render.preview", {"id": job["id"]})["ok"]
    assert call("slide.render.file", {"id": job["id"], "variant": "difference"})["error"]["code"] == "reference_unavailable"
    revised = saved(call, "slide.page.revise", {"id": page["id"], "layout": page["layout"]})
    assert revised["source_mode"] == "blueprint" and revised["asset_id"] is None
    page["layout"]["elements"].append({"kind": "image", "name": "unattributed", "x": 0, "y": 0, "width": 20, "height": 20,
        "source_x": 0, "source_y": 0, "source_width": 20, "source_height": 20, "description": "fixture"})
    assert call("slide.page.revise", {"id": revised["id"], "layout": page["layout"]}, "unknown-image")["error"]["code"] == "image_source_required"


def test_legacy_migration_preserves_pages_approvals_repairs_renders_and_exports(render_workspace, monkeypatch):
    call, page, adapter, _, _, rendered = render_workspace
    database = importlib.import_module(adapter.__package__ + ".database")
    saved(call, "slide.page.review", {"id": page["id"], "decision": "approved", "note": "legacy approval"})
    monkeypatch.setattr(adapter, "render", lambda *args: (rendered, {"version": "fixture", "measurements": [{
        "element_name": "title", "frame_width": 900, "frame_height": 50, "content_width": 800,
        "content_height": 500, "font_size": 30}]}))
    job = saved(call, "slide.render.begin", {"id": page["id"]})
    saved(call, "slide.render.run", {"id": job["id"]}, job["id"])
    repaired = saved(call, "slide.page.fit_text", {"id": job["id"]})["page"]
    tables = ("slide_render_jobs", "slide_page_repairs", "slide_deck_exports")
    with database.database() as conn:
        path = conn.execute("PRAGMA database_list").fetchone()[2]
        snapshot = {table: [tuple(row) for row in conn.execute(f"SELECT * FROM {table}")] for table in tables}
        before_pages = [dict(row) for row in conn.execute("SELECT * FROM slide_pages ORDER BY version")]
        hashes = {row["stored_path"]: row["sha256"] for row in conn.execute("SELECT * FROM slide_deck_exports")}
    # Build the real legacy schema, copying only its columns from the populated modern database.
    legacy = Path(path).with_name("schema-10-fixture.db")
    with sqlite3.connect(legacy) as conn:
        for migration in (database.SCHEMA, database.KNOWLEDGE_SCHEMA, database.DOCUMENT_SCHEMA, database.SLIDE_SCHEMA,
                          database.IMAGE_SCHEMA, database.IMAGE_ASSET_SCHEMA, database.IMAGE_ANALYSIS_SCHEMA,
                          database.RECONSTRUCTION_SCHEMA, database.RENDER_SCHEMA, database.REPAIR_SCHEMA):
            for statement in migration:
                conn.execute(statement)
        conn.execute("ATTACH DATABASE ? AS modern", (path,))
        tables_to_copy = [row[0] for row in conn.execute("SELECT name FROM main.sqlite_master WHERE type='table'")
                          if not row[0].startswith(("sqlite_", "source_fts_"))]
        for table in tables_to_copy:
            columns = ",".join(row[1] for row in conn.execute(f'PRAGMA main.table_info("{table}")'))
            conn.execute(f'INSERT INTO main."{table}"({columns}) SELECT {columns} FROM modern."{table}"')
        conn.execute("PRAGMA user_version=10")
        assert not conn.execute("PRAGMA foreign_key_check").fetchall()

    def legacy_connection(*_args):
        conn = sqlite3.connect(legacy)
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    monkeypatch.setattr(database, "plugin_db", legacy_connection)
    original_migration = database.TEMPLATE_SCHEMA
    monkeypatch.setattr(database, "TEMPLATE_SCHEMA", (*original_migration, "SELECT nonexistent_migration_table.id FROM nonexistent_migration_table"))
    with pytest.raises(sqlite3.OperationalError):
        call("slide.page.get", {"id": repaired["id"]})
    with sqlite3.connect(legacy) as conn:
        assert conn.execute("PRAGMA user_version").fetchone()[0] == 10
        assert "source_mode" not in {row[1] for row in conn.execute("PRAGMA table_info(slide_pages)")}
        assert conn.execute("SELECT COUNT(*) FROM slide_pages").fetchone()[0] == len(before_pages)
    monkeypatch.setattr(database, "TEMPLATE_SCHEMA", original_migration)
    assert call("slide.page.get", {"id": repaired["id"]})["data"]["source_mode"] == "vision"
    with database.database() as conn:
        assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1
        assert not conn.execute("PRAGMA foreign_key_check").fetchall()
        assert {table: [tuple(row) for row in conn.execute(f"SELECT * FROM {table}")] for table in tables} == snapshot
        after_pages = [dict(row) for row in conn.execute("SELECT * FROM slide_pages ORDER BY version")]
    assert [{key: value for key, value in row.items() if key != "source_mode"} for row in after_pages] == [
        {key: value for key, value in row.items() if key != "source_mode"} for row in before_pages]
    assert all(hashlib.sha256(Path(path).read_bytes()).hexdigest() == digest for path, digest in hashes.items())
