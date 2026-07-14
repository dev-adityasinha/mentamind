from pydantic import BaseModel, ConfigDict, Field

from app.models.organization import DataResidencyRegion


class RegisterOrganizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    org_name: str = Field(..., min_length=2, max_length=255)
    email: str = Field(..., min_length=1, max_length=320)
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=255)
    data_residency_region: DataResidencyRegion = DataResidencyRegion.IN


class LoginRequest(BaseModel):
    email: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class SpawnGhostResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    ghost_session_id: str


class GhostMergeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., min_length=1, max_length=320)
    display_name: str = Field(..., min_length=1, max_length=255)
    password: str = Field(..., min_length=8)


class ConsentUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    analytics: bool = False
    ai_coaching: bool = False
    community: bool = False
    version: str = "v1.0"


class RegisterRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    email: str = Field(..., min_length=1, max_length=320)
    password: str = Field(..., min_length=8)
    display_name: str = Field(..., min_length=1, max_length=255)
    org_id: str | None = None  # Optional org_id if joining an existing org


class VerifyEmailRequest(BaseModel):
    token: str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)
