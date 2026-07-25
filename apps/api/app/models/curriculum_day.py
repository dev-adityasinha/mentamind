import uuid
from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CurriculumBlock(Base):
    """One of the three journey blocks (Foundation / Depth / Integration)."""

    __tablename__ = "curriculum_blocks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    block: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    focus: Mapped[str] = mapped_column(Text, nullable=False, default="")
    meditation_focus: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reflection_focus: Mapped[str] = mapped_column(Text, nullable=False, default="")
    task_focus: Mapped[str] = mapped_column(Text, nullable=False, default="")
    color: Mapped[str] = mapped_column(String(100), nullable=False, default="")


class CurriculumDay(Base):
    """Static content for one day (1-30) of the guided meditation journey.

    The nested meditation / reflection / task objects are stored as JSONB to
    mirror the original content shape exactly. This is global content shared by
    every user, so there is no user_id / org_id.
    """

    __tablename__ = "curriculum_days"

    __table_args__ = (UniqueConstraint("day", name="uq_curriculum_day"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    day: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    block: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    subtitle: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    theme: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    mood_question: Mapped[str] = mapped_column(Text, nullable=False, default="")

    # Nested content objects, stored verbatim.
    meditation: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    reflection: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    task: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
