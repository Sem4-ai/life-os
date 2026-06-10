#!/usr/bin/env python3

import argparse
import asyncio
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    from telethon import TelegramClient
except ImportError:
    print("Telethon is not installed. Run: python3 -m pip install --user telethon", file=sys.stderr)
    sys.exit(1)


ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
PRIVATE_DIR = ROOT / ".private"
STATE_PATH = PRIVATE_DIR / "telegram-user-state.json"
REVIEW_PATH = PRIVATE_DIR / "telegram-review.md"


def load_env():
    env = dict(os.environ)
    if not ENV_PATH.exists():
        return env

    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        env[key.strip()] = value.strip().strip("\"'")
    return env


def require_env(env, key):
    value = env.get(key)
    if not value:
        raise RuntimeError(f"{key} is missing. Add it to .env.")
    return value


def load_state():
    if not STATE_PATH.exists():
        return {"chats": {}}
    try:
        data = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {"chats": {}}
    if not isinstance(data.get("chats"), dict):
        data["chats"] = {}
    return data


def save_state(state):
    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
    STATE_PATH.write_text(json.dumps(state, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def markdown_quote(text):
    lines = str(text or "").strip().splitlines() or [""]
    return "\n".join(f"> {line}" if line else ">" for line in lines)


def sanitize_title(value):
    return re.sub(r"\s+", " ", str(value or "Unknown chat")).strip()


def mention_names(env, me):
    configured = [
        item.strip().lower().lstrip("@")
        for item in env.get("TELEGRAM_MENTION_NAMES", "").split(",")
        if item.strip()
    ]
    if getattr(me, "username", None):
        configured.append(me.username.lower())
    return sorted(set(configured))


async def is_reply_to_me(client, message, my_id):
    if not getattr(message, "reply_to_msg_id", None):
        return False
    try:
        reply = await message.get_reply_message()
    except Exception:
        return False
    sender_id = getattr(reply, "sender_id", None)
    return sender_id == my_id


async def is_relevant(client, dialog, message, my_id, names):
    if getattr(message, "out", False):
        return False

    if dialog.is_user:
        return True

    text = message.message or ""
    lowered = text.lower()
    if getattr(message, "mentioned", False):
        return True
    if names and any(f"@{name}" in lowered for name in names):
        return True
    if await is_reply_to_me(client, message, my_id):
        return True
    return False


async def format_entry(client, dialog, message, me):
    sender = await message.get_sender()
    sender_name = sanitize_title(
        " ".join(
            part for part in [
                getattr(sender, "first_name", None),
                getattr(sender, "last_name", None),
            ] if part
        ) or getattr(sender, "username", None) or getattr(sender, "title", None) or message.sender_id
    )
    chat_name = sanitize_title(dialog.name)
    date = message.date.astimezone(timezone.utc).isoformat()
    chat_type = "private" if dialog.is_user else "group"
    text = message.message or ""

    return f"""## {date} / {chat_name}

Status: pending
Source: Telegram user client
Chat type: {chat_type}
Chat id: {dialog.id}
Message id: {message.id}
From: {sender_name}
Confidence: needs-assistant

### Message

{markdown_quote(text)}

### Assistant context check

- Нужно сверить с LifeOS: проекты, календарь, контекст, последние договоренности.
- Если уверенность ответа ниже 90%, углубиться в проектные заметки/календарь/историю и явно назвать, чего не хватает.

### Suggested reply

- требует разбора ассистентом

"""


def append_review(entries):
    if not entries:
        return

    PRIVATE_DIR.mkdir(parents=True, exist_ok=True)
    if not REVIEW_PATH.exists():
        REVIEW_PATH.write_text(
            "# Telegram review\n\n"
            "Локальная очередь сообщений для разбора ассистентом. Файл не коммитится в git.\n\n",
            encoding="utf-8",
        )

    with REVIEW_PATH.open("a", encoding="utf-8") as handle:
        for entry in entries:
            handle.write(entry)


async def get_client(env):
    api_id = int(require_env(env, "TELEGRAM_API_ID"))
    api_hash = require_env(env, "TELEGRAM_API_HASH")
    session = env.get("TELEGRAM_TELETHON_SESSION", ".private/telegram-telethon")
    session_path = Path(session)
    if not session_path.is_absolute():
        session_path = ROOT / session_path
    session_path.parent.mkdir(parents=True, exist_ok=True)
    return TelegramClient(str(session_path), api_id, api_hash)


async def login(args):
    env = load_env()
    client = await get_client(env)
    await client.start(phone=env.get("TELEGRAM_PHONE"))
    me = await client.get_me()
    await client.disconnect()
    print(f"Telegram user client is logged in as @{me.username or me.id}.")


async def status(args):
    env = load_env()
    client = await get_client(env)
    await client.connect()
    authorized = await client.is_user_authorized()
    if authorized:
        me = await client.get_me()
        print(f"Authorized: yes (@{me.username or me.id})")
    else:
        print("Authorized: no. Run `npm run lifeos -- telegram-user login`.")
    print(f"Review queue: {REVIEW_PATH}")
    await client.disconnect()


async def poll(args):
    env = load_env()
    client = await get_client(env)
    await client.start(phone=env.get("TELEGRAM_PHONE"))
    me = await client.get_me()
    names = mention_names(env, me)
    state = load_state()
    entries = []
    scanned = 0

    async for dialog in client.iter_dialogs():
        if not (dialog.is_user or dialog.is_group):
            continue

        chat_key = str(dialog.id)
        last_seen = int(state["chats"].get(chat_key, 0) or 0)
        max_seen = last_seen

        async for message in client.iter_messages(dialog.entity, limit=args.limit):
            scanned += 1
            max_seen = max(max_seen, int(message.id))
            if last_seen and message.id <= last_seen:
                break
            if not getattr(message, "message", None):
                continue
            if await is_relevant(client, dialog, message, me.id, names):
                entries.append(await format_entry(client, dialog, message, me))

        state["chats"][chat_key] = max_seen

    append_review(entries)
    save_state(state)
    await client.disconnect()
    print(f"Telegram user poll complete. Scanned: {scanned}. Added to review: {len(entries)}.")


async def monitor(args):
    while True:
        try:
            await poll(args)
        except Exception as exc:
            print(f"[{datetime.now(timezone.utc).isoformat()}] Telegram user monitor failed: {exc}", file=sys.stderr)
        await asyncio.sleep(args.interval)


def parse_args():
    parser = argparse.ArgumentParser(description="LifeOS Telegram user-client monitor")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("login")
    subparsers.add_parser("status")

    poll_parser = subparsers.add_parser("poll")
    poll_parser.add_argument("--limit", type=int, default=30)

    monitor_parser = subparsers.add_parser("monitor")
    monitor_parser.add_argument("--limit", type=int, default=30)
    monitor_parser.add_argument("--interval", type=int, default=300)

    return parser.parse_args()


async def main():
    args = parse_args()
    if args.command == "login":
        await login(args)
    elif args.command == "status":
        await status(args)
    elif args.command == "poll":
        await poll(args)
    elif args.command == "monitor":
        await monitor(args)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        pass
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
