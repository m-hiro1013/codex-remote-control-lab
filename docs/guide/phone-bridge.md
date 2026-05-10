# Phone Bridge

The phone bridge starts a local Codex app-server, waits for `/readyz`, and then starts a small HTTP/WebSocket bridge for browser clients on the LAN.

Its main job is to make the phone a remote control for the Codex session on your desktop. The desktop keeps the real Codex app-server local, while phone and desktop browsers can share the same bridge-managed thread.

## Start

```bash
npm ci
npm run phone
```

The command prints one URL per LAN IPv4 address:

```text
http://192.168.11.8:45214/?token=...
```

Open the exact printed URL from a phone or another browser on the same network. Use the phone to send prompts, approve work, inspect artifacts, and then resume the same thread from the desktop browser when you return to the PC.

## Runtime Layout

```text
phone browser
  -> token-protected bridge on 0.0.0.0:45214
  -> Codex app-server on ws://127.0.0.1:45213
```

The bridge shares a thread across multiple browser clients. Add `thread=<thread_id>` to resume a known Codex thread. This is the PC/mobile sync path: both devices are looking at the same bridge-managed Codex conversation instead of creating separate sessions.

## Useful Environment Variables

```bash
PHONE_UI_PORT=45214 npm run phone
CODEX_WORKDIR=/Users/admin/Prj/some-project npm run phone
CODEX_MODEL=gpt-5.4 npm run phone
PHONE_TOKEN=choose-your-own-token npm run phone
```

## UI Surface

- recent thread list and thread resume
- phone control of the desktop Codex session
- PC/mobile continuity through a shared bridge-managed thread
- model, plugin, config, auth, and automation lookups
- approval and sandbox mode controls for the next turn
- repository artifact preview
- Markdown rendering for chat and artifacts
- browser image attachments passed to Codex as `localImage` inputs
- simple, cyberpunk, and botanical color themes from the settings panel
- LAN sharing for a single bridge-managed thread
