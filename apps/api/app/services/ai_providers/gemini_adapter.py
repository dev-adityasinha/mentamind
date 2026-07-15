import json
import uuid
from typing import Any

import httpx

from app.services.ai_providers.base import AIProviderAdapter
from app.settings import settings


class GeminiAdapter(AIProviderAdapter):
    def __init__(self):
        self.api_key = getattr(settings, "gemini_api_key", "dummy")
        self.model = getattr(settings, "gemini_model", "gemini-1.5-pro")
        self.base_url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:generateContent"

    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any,
    ) -> tuple[str | None, list[dict] | None]:
        
        gemini_contents = []
        for msg in messages:
            if msg["role"] == "user":
                gemini_contents.append({"role": "user", "parts": [{"text": msg["content"]}]})
            elif msg["role"] == "assistant":
                gemini_contents.append({"role": "model", "parts": [{"text": msg["content"]}]})
        
        payload = {
            "system_instruction": {
                "parts": [{"text": system_prompt}]
            },
            "contents": gemini_contents,
        }
        
        if "tools" in kwargs:
            gemini_tools = []
            for t in kwargs["tools"]:
                if t["type"] == "function":
                    gemini_tools.append({
                        "name": t["function"]["name"],
                        "description": t["function"]["description"],
                        "parameters": t["function"]["parameters"]
                    })
            if gemini_tools:
                payload["tools"] = [{"function_declarations": gemini_tools}]

        url = f"{self.base_url}?key={self.api_key}"
        headers = {"Content-Type": "application/json"}

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(url, json=payload, headers=headers)
                if resp.status_code != 200:
                    return "I'm here for you.", None
                
                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    return "I'm here for you.", None
                
                parts = candidates[0].get("content", {}).get("parts", [])
                text_content = ""
                tool_calls = None
                
                for part in parts:
                    if "text" in part:
                        text_content += part["text"]
                    elif "functionCall" in part:
                        if not tool_calls:
                            tool_calls = []
                        fc = part["functionCall"]
                        tool_calls.append({
                            "id": str(uuid.uuid4()),
                            "type": "function",
                            "function": {
                                "name": fc["name"],
                                "arguments": json.dumps(fc["args"])
                            }
                        })
                        
                return text_content or None, tool_calls
        except Exception:
            return "I'm here for you.", None
