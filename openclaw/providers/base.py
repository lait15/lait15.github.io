from abc import ABC, abstractmethod
from typing import Any


class BaseLLMProvider(ABC):
    def __init__(self, model_name: str):
        self.model_name = model_name

    @abstractmethod
    async def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        """
        Send messages to the LLM and return the response.

        Returns dict with:
          - content: str (text response, may be empty if tool_calls exist)
          - tool_calls: list[dict] with keys: id, name, arguments (dict)
          - stop_reason: "end_turn" | "tool_use"
        """
        pass

    @abstractmethod
    async def chat_with_tool_result(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_call_id: str,
        tool_name: str,
        tool_result: Any,
    ) -> dict:
        """Continue conversation after a tool result."""
        pass
