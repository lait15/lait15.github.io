import os
import json
from typing import Any
from openai import AsyncOpenAI
from .base import BaseLLMProvider


class OpenAIProvider(BaseLLMProvider):
    def __init__(self, model_name: str):
        super().__init__(model_name)
        self.client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])

    def _tools_to_openai(self, tools: list[dict]) -> list:
        return [
            {
                "type": "function",
                "function": {
                    "name": tool["name"],
                    "description": tool["description"],
                    "parameters": tool.get("parameters", {"type": "object", "properties": {}}),
                },
            }
            for tool in tools
        ]

    async def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        kwargs = {"model": self.model_name, "messages": messages}
        if tools:
            kwargs["tools"] = self._tools_to_openai(tools)
            kwargs["tool_choice"] = "auto"

        response = await self.client.chat.completions.create(**kwargs)
        return self._parse_response(response)

    async def chat_with_tool_result(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_call_id: str,
        tool_name: str,
        tool_result: Any,
    ) -> dict:
        messages = messages + [
            {
                "role": "tool",
                "tool_call_id": tool_call_id,
                "content": str(tool_result),
            }
        ]
        return await self.chat(messages, tools)

    def _parse_response(self, response) -> dict:
        message = response.choices[0].message
        tool_calls = []

        if message.tool_calls:
            for tc in message.tool_calls:
                tool_calls.append({
                    "id": tc.id,
                    "name": tc.function.name,
                    "arguments": json.loads(tc.function.arguments),
                })

        return {
            "content": message.content or "",
            "tool_calls": tool_calls,
            "stop_reason": "tool_use" if tool_calls else "end_turn",
        }
