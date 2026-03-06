import os
import sys
import discord
from discord.ext import commands

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from core.agent import Agent

CHUNK_SIZE = 1900  # Discord message limit is 2000 chars


def get_intents() -> discord.Intents:
    intents = discord.Intents.default()
    intents.message_content = True
    return intents


class OpenClawBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix="!",
            intents=get_intents(),
            help_command=None,
        )
        self.agent = Agent()
        self.allowed_guild_ids = self._parse_allowed_guilds()
        # session history per channel: channel_id -> list of messages
        self.histories: dict[int, list[dict]] = {}

    def _parse_allowed_guilds(self) -> set[int]:
        raw = os.environ.get("ALLOWED_GUILD_IDS", "").strip()
        if not raw:
            return set()
        return {int(gid.strip()) for gid in raw.split(",") if gid.strip()}

    async def on_ready(self):
        provider = os.environ.get("MODEL_PROVIDER", "google")
        model = os.environ.get("MODEL_NAME", "gemini-1.5-flash")
        print(f"[OpenClaw] Logged in as {self.user} | Model: {provider}/{model}")

    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return

        # Guild restriction check
        if self.allowed_guild_ids and message.guild and message.guild.id not in self.allowed_guild_ids:
            return

        await self.process_commands(message)

        # Trigger on mention or !ask prefix
        is_mention = self.user in message.mentions
        is_ask = message.content.startswith("!ask ")

        if not is_mention and not is_ask:
            return

        if is_mention:
            user_input = message.content.replace(f"<@{self.user.id}>", "").strip()
            user_input = message.content.replace(f"<@!{self.user.id}>", "").strip()
        else:
            user_input = message.content[len("!ask "):].strip()

        if not user_input:
            await message.reply("何か質問や指示をどうぞ！")
            return

        # Show typing indicator
        async with message.channel.typing():
            channel_id = message.channel.id
            history = self.histories.get(channel_id, [])

            try:
                response_text = await self.agent.run(user_input, history)
            except Exception as e:
                response_text = f"エラーが発生しました: {e}"

            # Update history
            history.append({"role": "user", "content": user_input})
            history.append({"role": "assistant", "content": response_text})
            # Keep only last 20 messages to avoid token overflow
            self.histories[channel_id] = history[-20:]

        # Send response (split if too long)
        await self._send_chunked(message, response_text)

    @commands.command(name="clear")
    async def clear_history(self, ctx: commands.Context):
        """会話履歴をリセットする"""
        self.histories.pop(ctx.channel.id, None)
        await ctx.reply("会話履歴をリセットしました。")

    @commands.command(name="model")
    async def show_model(self, ctx: commands.Context):
        """現在使用中のモデルを表示する"""
        provider = os.environ.get("MODEL_PROVIDER", "google")
        model = os.environ.get("MODEL_NAME", "gemini-1.5-flash")
        await ctx.reply(f"現在のモデル: **{provider}/{model}**")

    @commands.command(name="help")
    async def help_command(self, ctx: commands.Context):
        """ヘルプを表示する"""
        help_text = (
            "**ミニOpenClaw ヘルプ**\n\n"
            "**使い方:**\n"
            "- `@ボット名 <メッセージ>` — ボットにメンション\n"
            "- `!ask <メッセージ>` — コマンドで質問\n\n"
            "**コマンド:**\n"
            "- `!clear` — 会話履歴をリセット\n"
            "- `!model` — 現在のモデルを確認\n"
            "- `!help` — このヘルプを表示\n\n"
            "**自動化ツール:**\n"
            "- Web ページの取得・分析\n"
            "- ファイルの読み書き（workspace/内）\n"
            "- コマンド実行（許可リスト内）\n"
        )
        await ctx.reply(help_text)

    async def _send_chunked(self, message: discord.Message, text: str):
        if len(text) <= CHUNK_SIZE:
            await message.reply(text)
            return
        chunks = [text[i:i + CHUNK_SIZE] for i in range(0, len(text), CHUNK_SIZE)]
        for i, chunk in enumerate(chunks):
            if i == 0:
                await message.reply(chunk)
            else:
                await message.channel.send(chunk)
