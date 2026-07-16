import uuid
from typing import Any

from openai import AsyncOpenAI

from app.services.ai_providers.base import AIProviderAdapter
from app.settings import settings


class OpenAIAdapter(AIProviderAdapter):
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=(
                settings.openai_api_key
                if hasattr(settings, "openai_api_key")
                else "dummy"
            ),
        )
        self.model = getattr(settings, "openai_model", "gpt-4o")

    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any,
    ) -> tuple[str | None, list[dict] | None]:
        full_messages = [{"role": "system", "content": system_prompt}] + messages

        create_kwargs = {
            "model": self.model,
            "messages": full_messages,
            "max_tokens": kwargs.get("max_tokens", 500),
            "temperature": kwargs.get("temperature", 0.7),
        }

        if "tools" in kwargs:
            create_kwargs["tools"] = kwargs["tools"]
        if "tool_choice" in kwargs:
            create_kwargs["tool_choice"] = kwargs["tool_choice"]

        response = await self.client.chat.completions.create(**create_kwargs)

        msg = response.choices[0].message
        content = msg.content
        tool_calls = None

        if msg.tool_calls:
            tool_calls = []
            for tc in msg.tool_calls:
                tool_calls.append(
                    {
                        "id": tc.id,
                        "type": tc.type,
                        "function": {
                            "name": tc.function.name,
                            "arguments": tc.function.arguments,
                        },
                    }
                )

        return content, tool_calls
