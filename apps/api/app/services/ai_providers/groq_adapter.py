import uuid
from typing import Any

from openai import AsyncOpenAI

from app.services.ai_providers.base import AIProviderAdapter
from app.settings import settings


class GroqAdapter(AIProviderAdapter):
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url=settings.groq_base_url,
        )
        self.model = settings.groq_model or "llama3-8b-8192"

    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any,
    ) -> tuple[str | None, list[dict] | None]:
        # Prepend system prompt
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

        import re

        if content:
            # Parse leaked function tags e.g. <function=recommend_meditation>{"category": "relaxation"}</function>
            matches = re.finditer(r'<function=([^>]+)>(.*?)</function>', content, flags=re.DOTALL)
            for match in matches:
                name = match.group(1).strip()
                args = match.group(2).strip()
                if tool_calls is None:
                    tool_calls = []
                tool_calls.append(
                    {
                        "id": f"call_{uuid.uuid4().hex[:8]}",
                        "type": "function",
                        "function": {
                            "name": name,
                            "arguments": args,
                        },
                    }
                )
            
            # Remove the tags from the final content
            content = re.sub(r'<function=[^>]+>.*?</function>', '', content, flags=re.DOTALL).strip()

        return content, tool_calls
