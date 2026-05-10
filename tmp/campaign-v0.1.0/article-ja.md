# Codex Remote Control Lab v0.1.0 を公開しました: Codex app-server を localhost に置いたままスマホから操作する実験場

Codex Remote Control Lab v0.1.0 を公開しました。OpenAI Codex CLI の `remote-control` / `app-server` を、ローカル優先で安全に試すための実験リポジトリです。

狙いはシンプルです。Codex app-server は `127.0.0.1` に閉じたままにして、同じ trusted LAN 上のスマホや別ブラウザには token 付きの小さな browser bridge だけを見せます。Codex app-server 自体を LAN サービスとして扱わず、操作面だけを橋渡しします。

## v0.1.0 で入っているもの

今回の初回リリースでは、bridge 本体、ブラウザ UI、公開ドキュメント、スクリーンショット証跡、検証フローをまとめました。

主な内容:

- repo-local の Codex CLI `0.130.0` app-server 起動
- 同一 LAN のブラウザ向け token-protected phone bridge
- phone と desktop browser で 1 つの bridge-managed thread を共有
- 最近の thread 一覧と resume
- artifact preview
- 次 turn 向けの approval / sandbox mode control
- model 選択
- 画像添付を Codex `localImage` input として送信
- chat と artifact preview の Markdown rendering
- project / thread の grouped navigation
- status / tool log の折りたたみ表示
- simple / cyberpunk / botanical のカラーテーマ
- VitePress と GitHub Pages による日英 docs

## localhost-first の安全境界

構成は次のようにしています。

```text
phone browser -> http://Mac-LAN-IP:45214 -> Node bridge -> ws://127.0.0.1:45213 -> Codex app-server
```

Codex app-server は localhost に残します。LAN に出るのは Node bridge だけで、page / API / upload / artifact / WebSocket path には token を要求します。

また、公開リポジトリに入れてはいけないローカル状態は Git から除外しています。

- `.phone-token`
- `.uploads/`
- `.codex-home*/`
- log
- generated docs output
- session database

## ブラウザ UI

UI は Codex Desktop 風のコンパクトな作業画面に寄せています。左に thread navigation、中央に conversation、右に artifact panel、下に composer という構成です。

v0.1.0 では、desktop / mobile / tablet、Markdown preview、image preview、grouped sidebar、status log、theme selector のスクリーンショットも docs に入れています。テーマは browser local storage に保存されるので、simple / cyberpunk / botanical を環境に合わせて切り替えられます。

## 検証

リリース前に次を確認しました。

```bash
npm run check
npm audit --omit=dev
npm run docs:build
xmllint --noout docs/public/logo.svg docs/public/social-card.svg
```

さらに test token で bridge を起動し、設定 panel に 3 つのテーマが表示されること、Cyberpunk に切り替えると `html[data-theme="cyberpunk"]` になることを確認しています。

GitHub Actions の CI と docs deploy も release commit で成功し、公開 docs も HTTP 200 を返すことを確認しました。

## リンク

- GitHub repository: https://github.com/Sunwood-ai-labs/codex-remote-control-lab
- v0.1.0 release: https://github.com/Sunwood-ai-labs/codex-remote-control-lab/releases/tag/v0.1.0
- Documentation: https://sunwood-ai-labs.github.io/codex-remote-control-lab/
- Phone bridge guide: https://sunwood-ai-labs.github.io/codex-remote-control-lab/guide/phone-bridge
- 日本語ドキュメント: https://sunwood-ai-labs.github.io/codex-remote-control-lab/ja/

