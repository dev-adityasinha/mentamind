import uuid
from abc import ABC, abstractmethod
from typing import Any


class AIProviderAdapter(ABC):
    @abstractmethod
    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any,
    ) -> tuple[str | None, list[dict] | None]:
        """
        Generate a response from the AI provider.
        """
        pass
