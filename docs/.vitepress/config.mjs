import { defineConfig } from "vitepress";

export default defineConfig({
  title: "Codex Remote Control Lab",
  description: "Local-first Codex app-server and phone bridge experiments.",
  base: "/codex-remote-control-lab/",
  cleanUrls: true,
  head: [
    ["link", { rel: "icon", href: "/codex-remote-control-lab/logo.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:title", content: "Codex Remote Control Lab" }],
    ["meta", { property: "og:description", content: "Local-first Codex app-server and token-protected LAN phone bridge experiments." }],
    ["meta", { property: "og:image", content: "https://sunwood-ai-labs.github.io/codex-remote-control-lab/social-card.svg" }],
  ],
  locales: {
    root: {
      label: "English",
      lang: "en-US",
      themeConfig: {
        nav: [
          { text: "Guide", link: "/guide/phone-bridge" },
          { text: "Safety", link: "/guide/security" },
          { text: "GitHub", link: "https://github.com/Sunwood-ai-labs/codex-remote-control-lab" },
        ],
        sidebar: [
          {
            text: "Guide",
            items: [
              { text: "Phone Bridge", link: "/guide/phone-bridge" },
              { text: "Protocol Notes", link: "/guide/protocol" },
              { text: "Security", link: "/guide/security" },
            ],
          },
        ],
      },
    },
    ja: {
      label: "日本語",
      lang: "ja-JP",
      link: "/ja/",
      themeConfig: {
        nav: [
          { text: "ガイド", link: "/ja/guide/phone-bridge" },
          { text: "安全設計", link: "/ja/guide/security" },
          { text: "GitHub", link: "https://github.com/Sunwood-ai-labs/codex-remote-control-lab" },
        ],
        sidebar: [
          {
            text: "ガイド",
            items: [
              { text: "Phone Bridge", link: "/ja/guide/phone-bridge" },
              { text: "Protocol Notes", link: "/ja/guide/protocol" },
              { text: "Security", link: "/ja/guide/security" },
            ],
          },
        ],
      },
    },
  },
  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Codex Remote",
    socialLinks: [{ icon: "github", link: "https://github.com/Sunwood-ai-labs/codex-remote-control-lab" }],
    search: {
      provider: "local",
    },
  },
});
