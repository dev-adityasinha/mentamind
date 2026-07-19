from app.services.ai_providers.base import AIProviderAdapter
from app.settings import settings


def get_ai_provider() -> AIProviderAdapter:
    """Return the configured AI provider adapter.

    Adapter modules are imported lazily (inside this function) so that the
    heavy provider SDKs are only loaded when the AI coach is actually used.
    Importing them at module load would pull the OpenAI SDK into memory on
    every startup, which matters on small (512MB) hosts.
    """
    provider = getattr(settings, "ai_provider", "groq").lower()

    if provider == "openai":
        from app.services.ai_providers.openai_adapter import OpenAIAdapter

        return OpenAIAdapter()
    elif provider == "anthropic":
        from app.services.ai_providers.anthropic_adapter import AnthropicAdapter

        return AnthropicAdapter()
    elif provider == "gemini":
        from app.services.ai_providers.gemini_adapter import GeminiAdapter

        return GeminiAdapter()
    else:
        from app.services.ai_providers.groq_adapter import GroqAdapter

        return GroqAdapter()
