from abc import ABC, abstractmethod
import uuid
from typing import Any

class AIProviderAdapter(ABC):
    @abstractmethod
    async def generate_response(
        self,
        messages: list[dict],
        system_prompt: str,
        user_id: uuid.UUID,
        **kwargs: Any
    ) -> str:
        """
        Generate a response from the AI provider.
        """
        pass
