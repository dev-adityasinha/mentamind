from app.services.ai_providers.anthropic_adapter import AnthropicAdapter
from app.services.ai_providers.base import AIProviderAdapter
from app.services.ai_providers.gemini_adapter import GeminiAdapter
from app.services.ai_providers.groq_adapter import GroqAdapter
from app.services.ai_providers.openai_adapter import OpenAIAdapter
from app.settings import settings


def get_ai_provider() -> AIProviderAdapter:
    provider = getattr(settings, "ai_provider", "groq").lower()

    if provider == "openai":
        return OpenAIAdapter()
    elif provider == "anthropic":
        return AnthropicAdapter()
    elif provider == "gemini":
        return GeminiAdapter()
    else:
        return GroqAdapter()
