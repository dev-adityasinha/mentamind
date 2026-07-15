import uuid
from typing import Any

import httpx

from app.services.ai_providers.base import AIProviderAdapter
from app.settings import settings


class AnthropicAdapter(AIProviderAdapter):
    def __init__(self):
        self.api_key = getattr(settings, "anthropic_api_key", "dummy")
        self.model = getattr(settings, "anthropic_model", "claude-3-haiku-20240307")
        self.base_url = "https://api.anthropic.com/v1/messages"

    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any,
    ) -> tuple[str | None, list[dict] | None]:
        
        anthropic_messages = []
        for msg in messages:
            if msg["role"] in ["user", "assistant"]:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"]
                })
        
        payload = {
            "model": self.model,
            "max_tokens": kwargs.get("max_tokens", 500),
            "system": system_prompt,
            "messages": anthropic_messages,
        }
        
        if "tools" in kwargs:
            # map openai tools to anthropic tools
            anthropic_tools = []
            for t in kwargs["tools"]:
                if t["type"] == "function":
                    anthropic_tools.append({
                        "name": t["function"]["name"],
                        "description": t["function"]["description"],
                        "input_schema": t["function"]["parameters"]
                    })
            if anthropic_tools:
                payload["tools"] = anthropic_tools

        headers = {
            "x-api-key": self.api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json"
        }

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(self.base_url, json=payload, headers=headers)
                if resp.status_code != 200:
                    return "I'm here for you.", None
                
                data = resp.json()
                content_blocks = data.get("content", [])
                
                text_content = ""
                tool_calls = None
                
                for block in content_blocks:
                    if block["type"] == "text":
                        text_content += block["text"]
                    elif block["type"] == "tool_use":
                        if not tool_calls:
                            tool_calls = []
                        import json
                        tool_calls.append({
                            "id": block["id"],
                            "type": "function",
                            "function": {
                                "name": block["name"],
                                "arguments": json.dumps(block["input"])
                            }
                        })
                        
                return text_content or None, tool_calls
        except Exception:
            return "I'm here for you.", None
