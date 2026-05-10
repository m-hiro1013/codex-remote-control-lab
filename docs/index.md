---
layout: home
hero:
  name: Codex Remote Control Lab
  text: Local-first phone control for Codex app-server experiments
  tagline: Keep Codex bound to localhost, then expose only a small token-protected bridge on your LAN.
  image:
    src: /logo.svg
    alt: Codex Remote Control Lab icon
  actions:
    - theme: brand
      text: Start the Bridge
      link: /guide/phone-bridge
    - theme: alt
      text: Security Model
      link: /guide/security
features:
  - title: Localhost-first
    details: The Codex app-server examples bind to 127.0.0.1. The LAN-facing surface is the Node bridge.
  - title: Phone-friendly
    details: A browser UI exposes threads, artifacts, model selection, approval controls, and image attachments.
  - title: Public-safe
    details: Token files, uploads, local Codex homes, logs, and session databases are ignored and documented as local-only.
---

## Quick Start

```bash
npm ci
npm run phone
```

Open the printed URL from a phone or another browser on the same Wi-Fi/LAN.

For protocol-only testing, run the app-server and probe from separate terminals:

```bash
npm run server:ws
npm run probe:ws
```

## Layout

```text
phone browser -> http://Mac-LAN-IP:45214 -> Node bridge -> ws://127.0.0.1:45213 -> Codex app-server
```

The app-server remains local. The bridge requires a token on page, API, and WebSocket requests.
