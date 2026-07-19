import functools
import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies.auth import get_current_user, require_roles
from app.models.meditation import (
    MeditationCategory,
    MeditationDifficulty,
    MeditationFavorite,
    MeditationStats,
    MeditationTrack,
)
from app.models.user import User, UserRole
from app.schemas.meditation import (
    AudioUploadResponse,
    MeditationFavoriteCreate,
    MeditationFavoriteResponse,
    MeditationHistoryCreate,
    MeditationHistoryResponse,
    MeditationStatsResponse,
    MeditationTrackCreate,
    MeditationTrackResponse,
    MeditationTrackUpdate,
)
from app.services.media_storage import MediaStorageError, store_audio
from app.services.meditation_tracker import submit_meditation_completion
from app.settings import settings

try:
    from fastapi_cache.decorator import cache
except ImportError:

    def cache(*args, **kwargs):
        def wrapper(func):
            @functools.wraps(func)
            async def inner(*args, **kwargs):
                return await func(*args, **kwargs)

            return inner

        return wrapper


router = APIRouter(prefix="/meditation", tags=["meditation"])

# Only admins / HR managers may manage the library.
_require_manager = require_roles(UserRole.ADMIN, UserRole.HR_MANAGER)

# Allowed audio content types -> file extension.
_ALLOWED_AUDIO_TYPES: dict[str, str] = {
    "audio/mpeg": ".mp3",
    "audio/mp3": ".mp3",
    "audio/wav": ".wav",
    "audio/x-wav": ".wav",
    "audio/ogg": ".ogg",
    "audio/mp4": ".m4a",
    "audio/aac": ".aac",
    "audio/webm": ".webm",
}


@router.get("/tracks", response_model=list[MeditationTrackResponse])
async def list_tracks(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    category: MeditationCategory | None = None,
    difficulty: MeditationDifficulty | None = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> list[MeditationTrack]:
    """List all available meditation tracks in the library, with optional filters."""
    stmt = select(MeditationTrack).order_by(MeditationTrack.created_at.desc())

    if category:
        stmt = stmt.where(MeditationTrack.category == category)
    if difficulty:
        stmt = stmt.where(MeditationTrack.difficulty == difficulty)

    stmt = stmt.limit(limit).offset(offset)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/tracks/{track_id}", response_model=MeditationTrackResponse)
async def get_track(
    track_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationTrack:
    """Get details of a specific meditation track."""
    track = await db.get(MeditationTrack, track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )
    return track


# ---------------------------------------------------------------------------
# Library management (admin only)
# ---------------------------------------------------------------------------


@router.post(
    "/tracks",
    response_model=MeditationTrackResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_track(
    body: MeditationTrackCreate,
    admin_user: Annotated[User, _require_manager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationTrack:
    """Create a new meditation session in the library."""
    track = MeditationTrack(
        title=body.title,
        description=body.description,
        audio_url=body.audio_url,
        duration_minutes=body.duration_minutes,
        category=body.category,
        difficulty=body.difficulty,
    )
    db.add(track)
    await db.commit()
    await db.refresh(track)
    return track


@router.patch("/tracks/{track_id}", response_model=MeditationTrackResponse)
async def update_track(
    track_id: uuid.UUID,
    body: MeditationTrackUpdate,
    admin_user: Annotated[User, _require_manager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationTrack:
    """Update an existing meditation session."""
    track = await db.get(MeditationTrack, track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )

    data = body.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(track, field, value)

    await db.commit()
    await db.refresh(track)
    return track


@router.delete("/tracks/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_track(
    track_id: uuid.UUID,
    admin_user: Annotated[User, _require_manager],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a meditation session from the library."""
    track = await db.get(MeditationTrack, track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )
    await db.delete(track)
    await db.commit()


@router.post(
    "/upload-audio",
    response_model=AudioUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_audio(
    admin_user: Annotated[User, _require_manager],
    file: Annotated[UploadFile, File(...)],
) -> AudioUploadResponse:
    """Upload an audio file to the app's media store and return its public URL.

    Admin-only. Validates the content type and size, then streams the file to
    the configured media directory. The returned URL can be used as a track's
    audio_url (via POST /tracks or PATCH /tracks/{id}).
    """
    content_type = (file.content_type or "").lower()
    ext = _ALLOWED_AUDIO_TYPES.get(content_type)
    if ext is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=("Unsupported audio type. Allowed: mp3, wav, ogg, m4a, aac, webm."),
        )

    # Read the upload into memory in chunks, enforcing the size cap before we
    # hand the bytes to the configured storage backend (local disk or R2).
    max_bytes = settings.max_audio_upload_mb * 1024 * 1024
    buffer = bytearray()
    try:
        while chunk := await file.read(1024 * 1024):
            buffer.extend(chunk)
            if len(buffer) > max_bytes:
                raise HTTPException(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    detail=(
                        f"File exceeds the {settings.max_audio_upload_mb}MB limit."
                    ),
                )
    finally:
        await file.close()

    filename = f"{uuid.uuid4().hex}{ext}"
    try:
        audio_url = await store_audio(bytes(buffer), filename, content_type)
    except MediaStorageError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store the uploaded file.",
        ) from exc

    return AudioUploadResponse(audio_url=audio_url)


# ---------------------------------------------------------------------------
# Progress
# ---------------------------------------------------------------------------


@router.post(
    "/history",
    response_model=MeditationHistoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def complete_meditation(
    body: MeditationHistoryCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Submit a completed meditation session to update user progress and streaks."""
    # Ensure track exists
    track = await db.get(MeditationTrack, body.track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )

    history = await submit_meditation_completion(
        db=db,
        user_id=current_user.id,
        track_id=track.id,
        duration_minutes=body.duration_minutes,
    )

    await db.commit()
    await db.refresh(history)

    # Needs explicit loading or returned as dict for Pydantic to serialize
    return {
        "id": history.id,
        "user_id": history.user_id,
        "track_id": history.track_id,
        "duration_minutes": history.duration_minutes,
        "completed_at": history.completed_at,
        "track": track,
    }


@router.get("/stats", response_model=MeditationStatsResponse)
async def get_my_stats(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationStats:
    """Get the current user's aggregated meditation stats (streaks, total minutes)."""
    result = await db.execute(
        select(MeditationStats).where(MeditationStats.user_id == current_user.id)
    )
    stats = result.scalar_one_or_none()

    if not stats:
        # Return default 0s if they haven't meditated yet
        return MeditationStats(
            user_id=current_user.id,
            total_minutes=0,
            total_sessions=0,
            current_streak=0,
            longest_streak=0,
            weekly_streak=0,
            longest_weekly_streak=0,
            last_meditated_at=None,
        )
    return stats


# ---------------------------------------------------------------------------
# Favorites
# ---------------------------------------------------------------------------


@router.get("/favorites", response_model=list[MeditationFavoriteResponse])
async def list_favorites(
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[MeditationFavorite]:
    """List the current user's favorited meditation tracks."""
    result = await db.execute(
        select(MeditationFavorite)
        .options(selectinload(MeditationFavorite.track))
        .where(MeditationFavorite.user_id == current_user.id)
        .order_by(MeditationFavorite.created_at.desc())
    )
    return result.scalars().all()


@router.post(
    "/favorites",
    response_model=MeditationFavoriteResponse,
    status_code=status.HTTP_201_CREATED,
)
async def add_favorite(
    body: MeditationFavoriteCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> MeditationFavorite:
    """Favorite a meditation track (idempotent)."""
    track = await db.get(MeditationTrack, body.track_id)
    if not track:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Track not found"
        )

    # If already favorited, return the existing record instead of erroring.
    existing = await db.execute(
        select(MeditationFavorite)
        .options(selectinload(MeditationFavorite.track))
        .where(
            MeditationFavorite.user_id == current_user.id,
            MeditationFavorite.track_id == body.track_id,
        )
    )
    found = existing.scalar_one_or_none()
    if found:
        return found

    favorite = MeditationFavorite(
        user_id=current_user.id,
        track_id=body.track_id,
    )
    db.add(favorite)
    await db.commit()

    # Reload with the track relationship eagerly loaded for serialization.
    result = await db.execute(
        select(MeditationFavorite)
        .options(selectinload(MeditationFavorite.track))
        .where(MeditationFavorite.id == favorite.id)
    )
    return result.scalar_one()


@router.delete("/favorites/{track_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_favorite(
    track_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Remove a track from the current user's favorites."""
    result = await db.execute(
        select(MeditationFavorite).where(
            MeditationFavorite.user_id == current_user.id,
            MeditationFavorite.track_id == track_id,
        )
    )
    favorite = result.scalar_one_or_none()
    if not favorite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Favorite not found"
        )
    await db.delete(favorite)
    await db.commit()
