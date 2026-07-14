from openai import AsyncOpenAI
import uuid
from typing import Any
from app.services.ai_providers.base import AIProviderAdapter
from app.settings import settings

class OpenAIAdapter(AIProviderAdapter):
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.openai_api_key if hasattr(settings, "openai_api_key") else "dummy",
        )
        self.model = getattr(settings, "openai_model", "gpt-4o")

    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any
    ) -> str:
        full_messages = [{"role": "system", "content": system_prompt}] + messages
        
        response = await self.client.chat.completions.create(
            model=self.model,
            messages=full_messages,
            max_tokens=kwargs.get("max_tokens", 500),
            temperature=kwargs.get("temperature", 0.7),
        )
        return response.choices[0].message.content or "I'm here for you."
