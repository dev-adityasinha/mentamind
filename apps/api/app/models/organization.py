import uuid
from datetime import UTC, datetime
from enum import StrEnum

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base
from app.db_types import PgEnum


class DataResidencyRegion(StrEnum):
    IN = "in"
    EU = "eu"
    US = "us"
    UAE = "uae"


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    data_residency_region: Mapped[DataResidencyRegion] = mapped_column(
        PgEnum(DataResidencyRegion), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
