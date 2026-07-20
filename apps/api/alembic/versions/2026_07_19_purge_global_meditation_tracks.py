"""Delete pre-fix meditation tracks that have no organization

Before org scoping existed, uploaded meditation tracks had no org_id. The
prior migration added a nullable org_id, leaving those rows NULL (treated as
global), so they showed for every org and could not be org-deleted. This
one-off data migration removes those orphaned NULL-org tracks.

Dependent rows in meditation_history / meditation_favorites are deleted first
so the purge succeeds regardless of whether the DB-level FK has ON DELETE
CASCADE (belt-and-suspenders; the models declare CASCADE but we don't rely on
it here).

Revision ID: 2026_07_19_purge_med
Revises: 2026_07_19_med_org
Create Date: 2026-07-19 00:00:00.000000

"""

from alembic import op

revision = "2026_07_19_purge_med"
down_revision = "2026_07_19_med_org"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Remove dependent rows first, then the orphaned (NULL-org) tracks.
    op.execute(
        "DELETE FROM meditation_history WHERE track_id IN "
        "(SELECT id FROM meditation_tracks WHERE org_id IS NULL)"
    )
    op.execute(
        "DELETE FROM meditation_favorites WHERE track_id IN "
        "(SELECT id FROM meditation_tracks WHERE org_id IS NULL)"
    )
    op.execute("DELETE FROM meditation_tracks WHERE org_id IS NULL")


def downgrade() -> None:
    # Deleted rows cannot be restored; this is intentionally a no-op.
    pass
