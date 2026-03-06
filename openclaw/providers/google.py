import os
import json
from typing import Any
import google.generativeai as genai
from .base import BaseLLMProvider


class GoogleProvider(BaseLLMProvider):
    def __init__(self, model_name: str):
        super().__init__(model_name)
        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])

    def _tools_to_gemini(self, tools: list[dict]) -> list:
        declarations = []
        for tool in tools:
            declarations.append(
                genai.protos.FunctionDeclaration(
                    name=tool["name"],
                    description=tool["description"],
                    parameters=genai.protos.Schema(
                        type=genai.protos.Type.OBJECT,
                        properties={
                            k: genai.protos.Schema(
                                type=genai.protos.Type.STRING,
                                description=v.get("description", ""),
                            )
                            for k, v in tool.get("parameters", {}).get("properties", {}).items()
                        },
                        required=tool.get("parameters", {}).get("required", []),
                    ),
                )
            )
        return [genai.protos.Tool(function_declarations=declarations)]

    def _messages_to_gemini(self, messages: list[dict]) -> tuple[str, list]:
        system_prompt = ""
        history = []
        for msg in messages:
            role = msg["role"]
            content = msg["content"]
            if role == "system":
                system_prompt = content
            elif role == "user":
                history.append({"role": "user", "parts": [content]})
            elif role == "assistant":
                history.append({"role": "model", "parts": [content]})
        return system_prompt, history

    async def chat(self, messages: list[dict], tools: list[dict]) -> dict:
        system_prompt, history = self._messages_to_gemini(messages)
        gemini_tools = self._tools_to_gemini(tools) if tools else None

        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt or None,
            tools=gemini_tools,
        )
        chat = model.start_chat(history=history[:-1] if history else [])
        last_message = history[-1]["parts"][0] if history else ""
        response = chat.send_message(last_message)

        return self._parse_response(response)

    async def chat_with_tool_result(
        self,
        messages: list[dict],
        tools: list[dict],
        tool_call_id: str,
        tool_name: str,
        tool_result: Any,
    ) -> dict:
        system_prompt, history = self._messages_to_gemini(messages)
        gemini_tools = self._tools_to_gemini(tools) if tools else None

        model = genai.GenerativeModel(
            model_name=self.model_name,
            system_instruction=system_prompt or None,
            tools=gemini_tools,
        )
        chat = model.start_chat(history=history[:-1] if history else [])

        last_user_message = history[-1]["parts"][0] if history else ""
        chat.send_message(last_user_message)

        tool_response = genai.protos.Part(
            function_response=genai.protos.FunctionResponse(
                name=tool_name,
                response={"result": str(tool_result)},
            )
        )
        response = chat.send_message(tool_response)
        return self._parse_response(response)

    def _parse_response(self, response) -> dict:
        tool_calls = []
        text_parts = []

        for part in response.parts:
            if hasattr(part, "function_call") and part.function_call.name:
                fc = part.function_call
                tool_calls.append({
                    "id": fc.name,
                    "name": fc.name,
                    "arguments": dict(fc.args),
                })
            elif hasattr(part, "text") and part.text:
                text_parts.append(part.text)

        return {
            "content": "\n".join(text_parts),
            "tool_calls": tool_calls,
            "stop_reason": "tool_use" if tool_calls else "end_turn",
        }
