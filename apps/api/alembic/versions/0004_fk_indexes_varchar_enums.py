"""add FK indexes and convert enum columns to VARCHAR + CHECK

Revision ID: 0004
Revises: 0003
Create Date: 2026-06-15

Migration 0002 created organizations.data_residency_region and users.role
as native PostgreSQL enum types and omitted indexes on several FK columns.
This migration corrects both:

1. Adds the missing FK indexes (departments.org_id, users.org_id,
   users.department_id, users.manager_id, refresh_tokens.user_id).

2. Converts the two native enum columns to VARCHAR(32) with CHECK
   constraints. VARCHAR + CHECK is preferred over native PG enum types in
   this codebase because adding new values requires only a CHECK update (no
   DDL lock, no type recreation), the asyncpg driver handles plain VARCHAR
   correctly without custom codecs, and the constraint still enforces valid
   values at the database level.

Downgrade restores the original native enum types and drops the indexes.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_DATA_RESIDENCY_VALUES = ("in", "eu", "us", "uae")
_USER_ROLE_VALUES = (
    "employee",
    "manager",
    "hr_manager",
    "wellness_officer",
    "admin",
    "counselor",
    "student",
)


def upgrade() -> None:
    # FK indexes missing from 0002
    op.create_index("ix_departments_org_id", "departments", ["org_id"])
    op.create_index("ix_users_org_id", "users", ["org_id"])
    op.create_index("ix_users_department_id", "users", ["department_id"])
    op.create_index("ix_users_manager_id", "users", ["manager_id"])
    op.create_index("ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"])

    # Convert organizations.data_residency_region to VARCHAR + CHECK.
    # The USING clause lets PostgreSQL cast existing enum values to text in-place.
    op.execute(
        "ALTER TABLE organizations "
        "ALTER COLUMN data_residency_region TYPE VARCHAR(32) "
        "USING data_residency_region::VARCHAR"
    )
    op.create_check_constraint(
        "ck_organizations_data_residency_region",
        "organizations",
        f"data_residency_region IN {_DATA_RESIDENCY_VALUES}",
    )

    # Convert users.role to VARCHAR + CHECK.
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(32) USING role::VARCHAR"
    )
    op.create_check_constraint(
        "ck_users_role",
        "users",
        f"role IN {_USER_ROLE_VALUES}",
    )

    # Drop the now-orphaned native enum types.
    op.execute("DROP TYPE data_residency_region")
    op.execute("DROP TYPE user_role")


def downgrade() -> None:
    # Recreate the native enum types before converting columns back.
    op.execute(f"CREATE TYPE data_residency_region AS ENUM {_DATA_RESIDENCY_VALUES}")
    op.execute(f"CREATE TYPE user_role AS ENUM {_USER_ROLE_VALUES}")

    op.drop_constraint(
        "ck_organizations_data_residency_region", "organizations", type_="check"
    )
    op.execute(
        "ALTER TABLE organizations "
        "ALTER COLUMN data_residency_region TYPE data_residency_region "
        "USING data_residency_region::data_residency_region"
    )

    op.drop_constraint("ck_users_role", "users", type_="check")
    op.execute(
        "ALTER TABLE users ALTER COLUMN role TYPE user_role USING role::user_role"
    )

    # Remove the FK indexes added by this migration.
    op.drop_index("ix_refresh_tokens_user_id", "refresh_tokens")
    op.drop_index("ix_users_manager_id", "users")
    op.drop_index("ix_users_department_id", "users")
    op.drop_index("ix_users_org_id", "users")
    op.drop_index("ix_departments_org_id", "departments")
