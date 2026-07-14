"""phase1_models_journal_ai_coach_audit_settings

Revision ID: 45ccfa8f8006
Revises: 65cf42eea05c
Create Date: 2026-06-20 03:39:28.147890
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "45ccfa8f8006"
down_revision: str | None = "65cf42eea05c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_EMOTION_SOURCE = ("checkin", "coach", "journal", "forum")
_TRIGGER_SOURCE = ("checkin", "coach", "journal", "forum", "manual")
_CRISIS_TYPE = ("suicide", "self_harm", "crisis")
_JOURNAL_TYPE = ("text", "voice", "gratitude", "ai_reflection")
_THEME_MODE = ("system", "light", "dark")
_NOTIF_CHANNEL = ("push", "email", "slack", "teams", "in_app")


def _values_sql(values: tuple[str, ...]) -> str:
    return "(" + ", ".join(f"'{v}'" for v in values) + ")"


def upgrade() -> None:
    # ---- new tables ----
    op.create_table(
        "ai_coach_sessions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=True),
        sa.Column("session_id", sa.String(255), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("message_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("crisis_detected", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("crisis_type", sa.String(20), nullable=True),
        sa.Column("escalated", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("escalated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("meta", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "ai_coach_messages",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("session_id", sa.Uuid(), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content_encrypted", sa.Text(), nullable=False),
        sa.Column("content_nonce", sa.String(32), nullable=False),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("emotion_tags", postgresql.JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["session_id"], ["ai_coach_sessions.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "audit_logs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("actor_user_id", sa.Uuid(), nullable=True),
        sa.Column("actor_role", sa.String(50), nullable=True),
        sa.Column("action", sa.String(100), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("resource_id", sa.Uuid(), nullable=True),
        sa.Column("org_id", sa.Uuid(), nullable=False),
        sa.Column("ip_address", sa.String(45), nullable=True),
        sa.Column("user_agent", sa.String(512), nullable=True),
        sa.Column("meta", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["actor_user_id"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["org_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "journal_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("entry_type", sa.String(20), nullable=False),
        sa.Column("content_encrypted", sa.Text(), nullable=False),
        sa.Column("content_nonce", sa.String(32), nullable=False),
        sa.Column("prompt", sa.Text(), nullable=True),
        sa.Column("mood_score", sa.SmallInteger(), nullable=True),
        sa.Column("emotion_tags", postgresql.ARRAY(sa.String()), server_default=sa.text("'{}'"), nullable=False),
        sa.Column("ai_reflection", sa.Text(), nullable=True),
        sa.Column("word_count", sa.Integer(), server_default=sa.text("0"), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "user_settings",
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("theme", sa.String(10), server_default=sa.text("'system'"), nullable=False),
        sa.Column("reminder_time", sa.String(5), nullable=True),
        sa.Column("notifications_enabled", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("email_notifications", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("push_notifications", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("slack_notifications", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("teams_notifications", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("privacy_analytics", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("privacy_ai_coaching", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("privacy_community", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("audio_bg_volume", sa.Float(), server_default=sa.text("0.5"), nullable=False),
        sa.Column("audio_voice_volume", sa.Float(), server_default=sa.text("0.8"), nullable=False),
        sa.Column("language", sa.String(10), server_default=sa.text("'en'"), nullable=False),
        sa.Column("timezone", sa.String(50), server_default=sa.text("'UTC'"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )

    # ---- indexes for new tables ----
    op.create_index("ix_ai_coach_sessions_crisis", "ai_coach_sessions", ["crisis_detected"])
    op.create_index(op.f("ix_ai_coach_sessions_session_id"), "ai_coach_sessions", ["session_id"])
    op.create_index("ix_ai_coach_sessions_user_id", "ai_coach_sessions", ["user_id"])
    op.create_index("ix_ai_coach_sessions_user_started", "ai_coach_sessions", ["user_id", "started_at"])
    op.create_index("ix_ai_coach_messages_created", "ai_coach_messages", ["created_at"])
    op.create_index("ix_ai_coach_messages_session_id", "ai_coach_messages", ["session_id"])
    op.create_index("ix_audit_logs_action", "audit_logs", ["action"])
    op.create_index("ix_audit_logs_actor_user_id", "audit_logs", ["actor_user_id"])
    op.create_index(op.f("ix_audit_logs_created_at"), "audit_logs", ["created_at"])
    op.create_index("ix_audit_logs_org_id", "audit_logs", ["org_id"])
    op.create_index("ix_audit_logs_resource", "audit_logs", ["resource_type", "resource_id"])
    op.create_index("ix_journal_entries_type", "journal_entries", ["entry_type"])
    op.create_index("ix_journal_entries_user_created", "journal_entries", ["user_id", "created_at"])
    op.create_index("ix_journal_entries_user_id", "journal_entries", ["user_id"])

    # ---- CHECK constraints for new tables ----
    op.execute(f"ALTER TABLE ai_coach_sessions ADD CONSTRAINT ck_ai_coach_sessions_crisis_type CHECK (crisis_type IS NULL OR crisis_type IN {_values_sql(_CRISIS_TYPE)})")
    op.execute(f"ALTER TABLE journal_entries ADD CONSTRAINT ck_journal_entries_entry_type CHECK (entry_type IN {_values_sql(_JOURNAL_TYPE)})")
    op.execute(f"ALTER TABLE user_settings ADD CONSTRAINT ck_user_settings_theme CHECK (theme IN {_values_sql(_THEME_MODE)})")

    # ---- alter existing tables: emotion_analyses ----
    op.add_column("emotion_analyses", sa.Column("session_id", sa.String(255), nullable=True))
    op.add_column("emotion_analyses", sa.Column("source", sa.String(20), server_default=sa.text("'checkin'"), nullable=False))
    op.alter_column("emotion_analyses", "user_id", existing_type=sa.Uuid(), nullable=True)
    op.create_index(op.f("ix_emotion_analyses_session_id"), "emotion_analyses", ["session_id"])
    op.create_index("ix_emotion_analyses_source", "emotion_analyses", ["source"])
    op.execute("CREATE INDEX IF NOT EXISTS ix_emotion_analyses_user_id ON emotion_analyses (user_id)")
    op.execute(f"ALTER TABLE emotion_analyses ADD CONSTRAINT ck_emotion_analyses_source CHECK (source IN {_values_sql(_EMOTION_SOURCE)})")

    # ---- alter existing tables: mood_logs ----
    op.add_column("mood_logs", sa.Column("voice_transcript", sa.Text(), nullable=True))
    op.add_column("mood_logs", sa.Column("voice_duration_seconds", sa.Integer(), nullable=True))
    op.add_column("mood_logs", sa.Column("ai_sentiment_score", sa.Float(), nullable=True))
    op.add_column("mood_logs", sa.Column("ai_emotion_tags", postgresql.JSONB, server_default=sa.text("'[]'::jsonb"), nullable=False))
    op.add_column("mood_logs", sa.Column("clinical_scores", postgresql.JSONB, nullable=True))
    op.add_column("mood_logs", sa.Column("session_id", sa.String(255), nullable=True))
    op.create_index("ix_mood_logs_session_id", "mood_logs", ["session_id"])

    # ---- alter existing tables: notification_events ----
    op.add_column("notification_events", sa.Column("channel", sa.String(20), server_default=sa.text("'in_app'"), nullable=False))
    op.add_column("notification_events", sa.Column("template_id", sa.String(100), nullable=True))
    op.create_index("ix_notification_events_channel", "notification_events", ["channel"])
    op.create_index("ix_notification_events_created_at", "notification_events", ["created_at"])
    op.execute(f"ALTER TABLE notification_events ADD CONSTRAINT ck_notification_events_channel CHECK (channel IN {_values_sql(_NOTIF_CHANNEL)})")

    # ---- alter existing tables: notification_events category (add new values) ----
    op.execute("ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS ck_notification_events_category")
    op.execute("ALTER TABLE notification_events ADD CONSTRAINT ck_notification_events_category CHECK (category IN ('checkin_reminder', 'burnout_alert', 'appointment_reminder', 'wellness_tip', 'consent_update', 'journal_prompt', 'coach_session', 'streak_milestone'))")

    # ---- alter existing tables: psychologist_summaries ----
    op.add_column("psychologist_summaries", sa.Column("session_id", sa.String(255), nullable=True))
    op.add_column("psychologist_summaries", sa.Column("trigger_source", sa.String(20), server_default=sa.text("'checkin'"), nullable=False))
    op.alter_column("psychologist_summaries", "user_id", existing_type=sa.Uuid(), nullable=True)
    op.create_index(op.f("ix_psychologist_summaries_session_id"), "psychologist_summaries", ["session_id"])
    op.execute("CREATE INDEX IF NOT EXISTS ix_psychologist_summaries_risk_level ON psychologist_summaries (risk_level)")
    op.execute(f"ALTER TABLE psychologist_summaries ADD CONSTRAINT ck_psychologist_summaries_trigger_source CHECK (trigger_source IN {_values_sql(_TRIGGER_SOURCE)})")

    # ---- alter existing tables: users ----
    op.add_column("users", sa.Column("consent_community", sa.Boolean(), server_default=sa.text("false"), nullable=False))
    op.add_column("users", sa.Column("privacy_consent_version", sa.String(32), server_default=sa.text("'v1.0'"), nullable=False))
    op.add_column("users", sa.Column("anonymous_session_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("saml_subject_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("saml_attributes", postgresql.JSONB, server_default=sa.text("'{}'::jsonb"), nullable=False))
    op.add_column("users", sa.Column("encryption_key_id", sa.String(255), nullable=True))
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_anonymous_session_id ON users (anonymous_session_id) WHERE anonymous_session_id IS NOT NULL")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ix_users_saml_subject_id ON users (saml_subject_id) WHERE saml_subject_id IS NOT NULL")

    # ---- alter existing tables: wellness_scores ----
    op.add_column("wellness_scores", sa.Column("computation_version", sa.String(32), server_default=sa.text("'v1.0'"), nullable=False))
    op.add_column("wellness_scores", sa.Column("anonymized_org_score", sa.SmallInteger(), nullable=True))
    op.create_index("ix_wellness_scores_score_date", "wellness_scores", ["score_date"])


def downgrade() -> None:
    # wellness_scores
    op.drop_index("ix_wellness_scores_score_date", table_name="wellness_scores")
    op.drop_column("wellness_scores", "anonymized_org_score")
    op.drop_column("wellness_scores", "computation_version")

    # users
    op.execute("DROP INDEX IF EXISTS ix_users_saml_subject_id")
    op.execute("DROP INDEX IF EXISTS ix_users_anonymous_session_id")
    op.drop_column("users", "deleted_at")
    op.drop_column("users", "encryption_key_id")
    op.drop_column("users", "saml_attributes")
    op.drop_column("users", "saml_subject_id")
    op.drop_column("users", "anonymous_session_id")
    op.drop_column("users", "privacy_consent_version")
    op.drop_column("users", "consent_community")

    # psychologist_summaries
    op.execute("ALTER TABLE psychologist_summaries DROP CONSTRAINT IF EXISTS ck_psychologist_summaries_trigger_source")
    op.drop_index(op.f("ix_psychologist_summaries_session_id"), table_name="psychologist_summaries")
    op.execute("DROP INDEX IF EXISTS ix_psychologist_summaries_risk_level")
    op.alter_column("psychologist_summaries", "user_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("psychologist_summaries", "trigger_source")
    op.drop_column("psychologist_summaries", "session_id")

    # notification_events
    op.execute("ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS ck_notification_events_channel")
    op.drop_index("ix_notification_events_created_at", table_name="notification_events")
    op.drop_index("ix_notification_events_channel", table_name="notification_events")
    op.drop_column("notification_events", "template_id")
    op.drop_column("notification_events", "channel")
    op.execute("ALTER TABLE notification_events DROP CONSTRAINT IF EXISTS ck_notification_events_category")
    op.execute("ALTER TABLE notification_events ADD CONSTRAINT ck_notification_events_category CHECK (category IN ('checkin_reminder', 'burnout_alert', 'appointment_reminder', 'wellness_tip', 'consent_update'))")

    # mood_logs
    op.drop_index("ix_mood_logs_session_id", table_name="mood_logs")
    op.drop_column("mood_logs", "session_id")
    op.drop_column("mood_logs", "clinical_scores")
    op.drop_column("mood_logs", "ai_emotion_tags")
    op.drop_column("mood_logs", "ai_sentiment_score")
    op.drop_column("mood_logs", "voice_duration_seconds")
    op.drop_column("mood_logs", "voice_transcript")

    # emotion_analyses
    op.execute("ALTER TABLE emotion_analyses DROP CONSTRAINT IF EXISTS ck_emotion_analyses_source")
    op.drop_index("ix_emotion_analyses_source", table_name="emotion_analyses")
    op.drop_index(op.f("ix_emotion_analyses_session_id"), table_name="emotion_analyses")
    op.alter_column("emotion_analyses", "user_id", existing_type=sa.Uuid(), nullable=False)
    op.drop_column("emotion_analyses", "source")
    op.drop_column("emotion_analyses", "session_id")

    # new tables
    op.drop_index("ix_ai_coach_messages_session_id", table_name="ai_coach_messages")
    op.drop_index("ix_ai_coach_messages_created", table_name="ai_coach_messages")
    op.drop_table("ai_coach_messages")
    op.drop_table("user_settings")
    op.drop_index("ix_journal_entries_user_id", table_name="journal_entries")
    op.drop_index("ix_journal_entries_user_created", table_name="journal_entries")
    op.drop_index("ix_journal_entries_type", table_name="journal_entries")
    op.drop_table("journal_entries")
    op.drop_index("ix_audit_logs_resource", table_name="audit_logs")
    op.drop_index("ix_audit_logs_org_id", table_name="audit_logs")
    op.drop_index(op.f("ix_audit_logs_created_at"), table_name="audit_logs")
    op.drop_index("ix_audit_logs_actor_user_id", table_name="audit_logs")
    op.drop_index("ix_audit_logs_action", table_name="audit_logs")
    op.drop_table("audit_logs")
    op.drop_index("ix_ai_coach_sessions_user_started", table_name="ai_coach_sessions")
    op.drop_index("ix_ai_coach_sessions_user_id", table_name="ai_coach_sessions")
    op.drop_index(op.f("ix_ai_coach_sessions_session_id"), table_name="ai_coach_sessions")
    op.drop_index("ix_ai_coach_sessions_crisis", table_name="ai_coach_sessions")
    op.execute("ALTER TABLE ai_coach_sessions DROP CONSTRAINT IF EXISTS ck_ai_coach_sessions_crisis_type")
    op.drop_table("ai_coach_sessions")
    op.execute("ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS ck_journal_entries_entry_type")
    op.execute("ALTER TABLE user_settings DROP CONSTRAINT IF EXISTS ck_user_settings_theme")
