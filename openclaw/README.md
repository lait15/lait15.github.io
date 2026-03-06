# ミニOpenClaw

OpenClaw (https://openclaw.ai) にインスパイアされた簡易AIアシスタントBot。

Discord から AI エージェントを操作し、Web取得・ファイル操作・コマンド実行などの自動化タスクを実行できます。

## 対応AIモデル

| プロバイダー | モデル例 | 費用 |
|------------|---------|------|
| Google (デフォルト) | gemini-1.5-flash, gemini-2.0-flash | 激安・無料枠あり |
| OpenAI | gpt-4o-mini, gpt-4o | 安価 |
| Anthropic | claude-haiku-4-5, claude-sonnet-4-6 | 日本語精度高 |

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd openclaw
pip install -r requirements.txt
```

### 2. 環境変数の設定

```bash
cp .env.example .env
```

`.env` を編集して以下を設定：

```env
MODEL_PROVIDER=google          # google / openai / anthropic
MODEL_NAME=gemini-1.5-flash    # 使いたいモデル名
GOOGLE_API_KEY=your_key_here   # 使うプロバイダーのAPIキー
DISCORD_BOT_TOKEN=your_token   # Discord Botトークン
```

### 3. Discord Bot の作成

1. https://discord.com/developers/applications にアクセス
2. 「New Application」→ 「Bot」→ 「Add Bot」
3. 「MESSAGE CONTENT INTENT」を有効化
4. Bot Token をコピーして `.env` の `DISCORD_BOT_TOKEN` に設定
5. Bot を自分のサーバーに招待（Permissions: `Send Messages`, `Read Message History`）

### 4. APIキーの取得

- **Google**: https://aistudio.google.com/apikey （無料）
- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/

### 5. 起動

```bash
python main.py
```

## 使い方

Discord でボットをメンションするか `!ask` コマンドを使います：

```
@ミニOpenClaw 東京の今日の天気を教えて
!ask https://example.com のページを要約して
!ask workspace/report.txt というファイルを作って「Hello World」と書いて
```

### コマンド一覧

| コマンド | 説明 |
|---------|------|
| `@bot <メッセージ>` | ボットにメンション |
| `!ask <メッセージ>` | 質問・指示 |
| `!clear` | 会話履歴をリセット |
| `!model` | 現在のモデルを確認 |
| `!help` | ヘルプを表示 |

## 自動化ツール

| ツール | 説明 |
|-------|------|
| `web_fetch` | URLのWebページを取得・テキスト抽出 |
| `read_file` | `workspace/` 内のファイルを読む |
| `write_file` | `workspace/` 内にファイルを書く |
| `run_command` | 許可されたコマンドを実行 |

## セキュリティ

- コマンド実行は `.env` の `ALLOWED_COMMANDS` に列挙したものだけ許可
- ファイル操作は `workspace/` ディレクトリ内のみ
- `ALLOWED_GUILD_IDS` で特定のDiscordサーバーのみ許可可能

## モデルの切り替え

`.env` の `MODEL_PROVIDER` と `MODEL_NAME` を変更して再起動するだけです：

```env
# Gemini（無料枠あり・激安）
MODEL_PROVIDER=google
MODEL_NAME=gemini-1.5-flash

# OpenAI
MODEL_PROVIDER=openai
MODEL_NAME=gpt-4o-mini

# Anthropic（日本語精度高）
MODEL_PROVIDER=anthropic
MODEL_NAME=claude-haiku-4-5
```
