import os
from typing import Any
import anthropic
from .base import BaseLLMProvider


class AnthropicProvider(BaseLLMProvider):
    def __init__(self, model_name: str):
        super().__init__(model_name)
        self.client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    def _tools_to_anthropic(self, tools: list[dict]) -> list:
        return [
            {
                "name": tool["name"],
                "description": tool["description"],
                "input_schema": tool.get("parameters", {"type": "object", "properties": {}}),
            }
            for tool in tools
        ]

    def _extract_system(self, messages: list[dict]) -> tuple[str, list[dict]]:
        system = ""
        filtered = []
        for msg in messages:
            if msg["role"] == "system":
                system = msg["content"]
            else:
                filtered.append(msg)
        return system, filtered

    async def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        system, msgs = self._extract_system(messages)
        kwargs = {
            "model": self.model_name,
            "max_tokens": 4096,
            "messages": msgs,
        }
        if system:
            kwargs["system"] = system
        if tools:
            kwargs["tools"] = self._tools_to_anthropic(tools)

        response = await self.client.messages.create(**kwargs)
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
                "role": "user",
                "content": [
                    {
                        "type": "tool_result",
                        "tool_use_id": tool_call_id,
                        "content": str(tool_result),
                    }
                ],
            }
        ]
        return await self.chat(messages, tools)

    def _parse_response(self, response) -> dict:
        tool_calls = []
        text_parts = []

        for block in response.content:
            if block.type == "tool_use":
                tool_calls.append({
                    "id": block.id,
                    "name": block.name,
                    "arguments": block.input,
                })
            elif block.type == "text":
                text_parts.append(block.text)

        return {
            "content": "\n".join(text_parts),
            "tool_calls": tool_calls,
            "stop_reason": "tool_use" if tool_calls else "end_turn",
        }
