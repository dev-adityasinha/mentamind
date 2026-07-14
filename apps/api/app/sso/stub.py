from app.sso.base import SAMLAdapter, SSOUser


class StubSAMLAdapter(SAMLAdapter):
    """No-op implementation: replace with a real IdP adapter (e.g. python3-saml)."""

    def get_auth_request_url(self, return_url: str) -> str:
        return f"https://stub-idp.example.com/saml/auth?return={return_url}"

    def process_response(self, saml_response: str) -> SSOUser:
        return SSOUser(
            email="stub@example.com",
            display_name="Stub SSO User",
            external_id="stub-external-id-001",
        )

    def get_metadata_xml(self) -> str:
        return "<EntityDescriptor><!-- stub SP metadata --></EntityDescriptor>"
