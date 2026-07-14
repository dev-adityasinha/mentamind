from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class SSOUser:
    email: str
    display_name: str
    external_id: str


class SAMLAdapter(ABC):
    """Abstract SAML 2.0 adapter: plug in a real IdP by subclassing this."""

    @abstractmethod
    def get_auth_request_url(self, return_url: str) -> str:
        """Build and return the IdP redirect URL for initiating SAML auth."""

    @abstractmethod
    def process_response(self, saml_response: str) -> SSOUser:
        """Validate the SAML assertion and return normalised user attributes."""

    @abstractmethod
    def get_metadata_xml(self) -> str:
        """Return SP metadata XML for registration with the IdP."""
