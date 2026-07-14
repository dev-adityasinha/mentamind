"""Custom SQLAlchemy column types shared across models."""

import enum
import json
from typing import Any

from sqlalchemy import String, Text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.types import TypeDecorator


class PgEnum(TypeDecorator):
    """Store a Python str-enum as a plain VARCHAR in SQLAlchemy's binding layer.

    asyncpg's native enum codec uses `.name` (uppercase) on Python enum objects
    instead of `.value`. This TypeDecorator converts to `.value` on write and
    back to the enum member on read, so callers always work with typed members.
    DB columns are VARCHAR + CHECK (see migration 0004 for the rationale).
    """

    impl = String
    cache_ok = True

    def __init__(self, enum_class: type[enum.Enum], *args: Any, **kwargs: Any) -> None:
        super().__init__(*args, **kwargs)
        self.enum_class = enum_class

    def process_bind_param(self, value: Any, dialect: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, self.enum_class):
            return value.value
        return str(value)

    def process_result_value(self, value: Any, dialect: Any) -> enum.Enum | None:
        if value is None:
            return None
        return self.enum_class(value)


class TextArrayType(TypeDecorator):
    """Text array stored as native ARRAY on PostgreSQL, JSON-encoded text elsewhere.

    SQLite does not have an array type. Tests run on SQLite, so we serialise
    to JSON for non-PostgreSQL dialects. The in-memory representation is always
    list[str] regardless of the backing dialect.
    """

    impl = Text
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(ARRAY(Text()))
        return dialect.type_descriptor(Text())

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        return json.dumps(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        if dialect.name == "postgresql":
            return value
        if isinstance(value, str):
            return json.loads(value)
        return value
