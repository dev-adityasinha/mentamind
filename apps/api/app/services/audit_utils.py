import uuid as uuid_module
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audit_log import AuditLog


async def log_audit_event(
    db: AsyncSession,
    actor_user_id: uuid_module.UUID | None,
    actor_role: str | None,
    action: str,
    resource_type: str,
    resource_id: uuid_module.UUID | None,
    org_id: uuid_module.UUID,
    ip_address: str | None = None,
    user_agent: str | None = None,
    meta: dict[str, Any] | None = None,
    success: bool = True,
    error_message: str | None = None,
) -> AuditLog:
    """Record an audit log entry for a sensitive operation."""
    entry = AuditLog(
        actor_user_id=actor_user_id,
        actor_role=actor_role,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        org_id=org_id,
        ip_address=ip_address,
        user_agent=user_agent,
        meta=meta or {},
        success=success,
        error_message=error_message,
    )
    db.add(entry)
    await db.commit()
    return entry
