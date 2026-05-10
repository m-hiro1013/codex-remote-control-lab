# Codex Remote Control Lab v0.1.0: phone control for a localhost-first Codex app-server

Codex Remote Control Lab v0.1.0 is the first public release of a local-first experiment for OpenAI Codex CLI `remote-control` and `app-server` workflows.

The idea is simple: keep the Codex app-server bound to `127.0.0.1`, then expose only a small token-protected browser bridge to devices on the same trusted LAN. That gives you a phone-friendly control surface without treating the Codex app-server itself as a LAN service.

## What shipped

The release packages a working bridge, browser UI, public documentation, screenshot evidence, and release validation into one repository.

Highlights:

- a repository-local Codex CLI `0.130.0` app-server launcher
- a token-protected phone bridge for same-LAN browser clients
- one shared bridge-managed thread across phone and desktop browsers
- recent thread resume
- artifact preview
- approval and sandbox mode controls for the next turn
- model selection
- image attachments sent to Codex as `localImage` inputs
- Markdown rendering in chat and artifact previews
- grouped project/thread navigation
- collapsed status and tool logs
- simple, cyberpunk, and botanical color themes
- bilingual docs through VitePress and GitHub Pages

## Localhost-first by design

The important boundary is intentional:

```text
phone browser -> http://Mac-LAN-IP:45214 -> Node bridge -> ws://127.0.0.1:45213 -> Codex app-server
```

The Codex app-server remains on localhost. The LAN-facing surface is the Node bridge, and that bridge requires a token on page, API, upload, artifact, and WebSocket paths.

The repository also keeps local-only state out of Git:

- `.phone-token`
- `.uploads/`
- `.codex-home*/`
- logs
- generated docs output
- session databases

## Browser UI

The browser UI is modeled after a compact Codex Desktop-style workspace: thread navigation on the left, conversation in the center, artifacts on the right, and a bottom composer for the next turn.

For v0.1.0, the UI includes screenshots for desktop, mobile, tablet, Markdown previews, image previews, grouped sidebars, status logs, and the new theme selector. The theme selector stores the selected theme in browser local storage, so the UI can stay readable for different environments.

## Validation

The release was checked with:

```bash
npm run check
npm audit --omit=dev
npm run docs:build
xmllint --noout docs/public/logo.svg docs/public/social-card.svg
```

I also smoke-tested the running bridge with a test token and confirmed the settings panel showed the three themes. Switching to Cyberpunk set `html[data-theme="cyberpunk"]`.

GitHub Actions CI and the docs deployment completed successfully for the release commit, and the live documentation returned HTTP 200.

## Links

- GitHub repository: https://github.com/Sunwood-ai-labs/codex-remote-control-lab
- v0.1.0 release: https://github.com/Sunwood-ai-labs/codex-remote-control-lab/releases/tag/v0.1.0
- Documentation: https://sunwood-ai-labs.github.io/codex-remote-control-lab/
- Phone bridge guide: https://sunwood-ai-labs.github.io/codex-remote-control-lab/guide/phone-bridge
- Japanese documentation: https://sunwood-ai-labs.github.io/codex-remote-control-lab/ja/

