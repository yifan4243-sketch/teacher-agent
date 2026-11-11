"""Resolve business modules when an operation is invoked, after plugin registration."""

from dataclasses import dataclass, field
from functools import partial
from importlib import import_module


def _symbol(path):
    module, name = path.rsplit(".", 1)
    return getattr(import_module("." + module, __package__), name)


@dataclass(frozen=True)
class Operation:
    schema_path: str
    handler_path: str
    arguments: dict = field(default_factory=dict)

    def resolve(self):
        return _symbol(self.schema_path), partial(_symbol(self.handler_path), **self.arguments)


def operation_schema(conn, data, model_path):
    return _symbol(model_path).model_json_schema()


def get_task(conn, data):
    from .workflows import get_task as read_task
    return read_task(conn, data.id)


def list_tasks(conn, data):
    from .workflows import list_tasks as read_tasks
    return read_tasks(conn)
