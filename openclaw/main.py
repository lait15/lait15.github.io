#!/usr/bin/env python3
"""ミニOpenClaw エントリーポイント"""
import os
import sys
from pathlib import Path

# Load .env file
env_path = Path(__file__).parent / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)
else:
    print(f"[Warning] .env not found at {env_path}")
    print("  Run: cp .env.example .env  and fill in your API keys")

# Validate required env vars
provider = os.environ.get("MODEL_PROVIDER", "google")
required_keys = {
    "google": "GOOGLE_API_KEY",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}
key_name = required_keys.get(provider, "")
if key_name and not os.environ.get(key_name):
    print(f"[Error] {key_name} is not set in .env for provider '{provider}'")
    sys.exit(1)

discord_token = os.environ.get("DISCORD_BOT_TOKEN")
if not discord_token:
    print("[Error] DISCORD_BOT_TOKEN is not set in .env")
    sys.exit(1)

# Start the bot
from bot.discord_bot import OpenClawBot

bot = OpenClawBot()
print(f"[OpenClaw] Starting with provider: {provider}/{os.environ.get('MODEL_NAME', 'gemini-1.5-flash')}")
bot.run(discord_token)
