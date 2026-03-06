import os
from providers import get_provider
from tools import TOOLS, execute_tool

SYSTEM_PROMPT = """あなたは役立つAIアシスタントです。
ユーザーのタスクを完了するために、利用可能なツールを積極的に使用してください。

利用可能なツール:
- web_fetch: WebページのURLからテキストを取得
- read_file: ワークスペース内のファイルを読む
- write_file: ワークスペース内のファイルを書く
- run_command: 許可されたシェルコマンドを実行

日本語でコミュニケーションしてください。"""

MAX_TOOL_ITERATIONS = 10


class Agent:
    def __init__(self):
        provider_name = os.environ.get("MODEL_PROVIDER", "google")
        model_name = os.environ.get("MODEL_NAME", "gemini-1.5-flash")
        self.provider = get_provider(provider_name, model_name)
        self.provider_name = provider_name

    async def run(self, user_message: str, history: list[dict] | None = None) -> str:
        """
        Run the agent with a user message and optional conversation history.
        Returns the final text response.
        """
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        if history:
            messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        for _ in range(MAX_TOOL_ITERATIONS):
            response = await self.provider.chat(messages, TOOLS)

            if response["stop_reason"] == "end_turn" or not response["tool_calls"]:
                return response["content"] or "(応答なし)"

            # Execute tool calls
            tool_results = []
            for tool_call in response["tool_calls"]:
                result = execute_tool(tool_call["name"], tool_call["arguments"])
                tool_results.append((tool_call["id"], tool_call["name"], result))

            # Add assistant message with tool calls to history
            messages = self._append_assistant_with_tools(messages, response)

            # Get next response with tool results
            for tool_id, tool_name, tool_result in tool_results:
                response = await self.provider.chat_with_tool_result(
                    messages, TOOLS, tool_id, tool_name, tool_result
                )
                messages = self._append_tool_result(messages, tool_id, tool_name, tool_result)

            if response["stop_reason"] == "end_turn" or not response["tool_calls"]:
                return response["content"] or "(応答なし)"

        return "最大ツール呼び出し回数に達しました。"

    def _append_assistant_with_tools(self, messages: list[dict], response: dict) -> list[dict]:
        if self.provider_name == "anthropic":
            content = []
            if response["content"]:
                content.append({"type": "text", "text": response["content"]})
            for tc in response["tool_calls"]:
                content.append({
                    "type": "tool_use",
                    "id": tc["id"],
                    "name": tc["name"],
                    "input": tc["arguments"],
                })
            messages.append({"role": "assistant", "content": content})
        else:
            messages.append({"role": "assistant", "content": response["content"]})
        return messages

    def _append_tool_result(
        self, messages: list[dict], tool_id: str, tool_name: str, result: str
    ) -> list[dict]:
        if self.provider_name == "openai":
            messages.append({
                "role": "tool",
                "tool_call_id": tool_id,
                "content": result,
            })
        elif self.provider_name == "anthropic":
            messages.append({
                "role": "user",
                "content": [{
                    "type": "tool_result",
                    "tool_use_id": tool_id,
                    "content": result,
                }],
            })
        else:
            messages.append({
                "role": "user",
                "content": f"[Tool result for {tool_name}]: {result}",
            })
        return messages
