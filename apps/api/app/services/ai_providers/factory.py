from app.services.ai_providers.base import AIProviderAdapter
from app.services.ai_providers.groq_adapter import GroqAdapter
from app.services.ai_providers.openai_adapter import OpenAIAdapter
from app.settings import settings


def get_ai_provider() -> AIProviderAdapter:
    provider = getattr(settings, "ai_provider", "groq").lower()

    if provider == "openai":
        return OpenAIAdapter()
    elif provider == "anthropic":
        raise NotImplementedError("Anthropic adapter not fully implemented yet.")
    elif provider == "gemini":
        raise NotImplementedError("Gemini adapter not fully implemented yet.")
    else:
        return GroqAdapter()
