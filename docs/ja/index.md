---
layout: home
hero:
  name: Codex Remote Control Lab
  text: Codex app-server を localhost に置いたままスマホから操作する実験場
  tagline: LAN に出すのは token 付きの小さな bridge だけ。Codex 本体の WebSocket は 127.0.0.1 に閉じます。
  image:
    src: /logo.svg
    alt: Codex Remote Control Lab icon
  actions:
    - theme: brand
      text: Bridge を起動
      link: /ja/guide/phone-bridge
    - theme: alt
      text: 安全設計
      link: /ja/guide/security
features:
  - title: localhost 優先
    details: Codex app-server は 127.0.0.1 に bind し、LAN に出すのは Node bridge だけです。
  - title: スマホ向け
    details: thread、artifact、model、承認、画像添付をブラウザ UI から扱えます。
  - title: 公開安全
    details: token、upload、Codex home、log、session database は Git に入れない前提で整理しています。
---

## Quick Start

```bash
npm ci
npm run phone
```

Mac に表示された URL を、同じ Wi-Fi/LAN 上のスマホや別ブラウザで開きます。

protocol だけを確認する場合は、別 terminal で app-server と probe を動かします。

```bash
npm run server:ws
npm run probe:ws
```
