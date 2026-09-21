import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src/client", import.meta.url)) },
  },
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    VitePWA({
      registerType: "autoUpdate",
      // CSP でインラインのスクリプトを許さないので、登録は別ファイルにする
      injectRegister: "script",
      includeAssets: ["icon.svg", "apple-touch-icon.png", "theme-boot.js"],
      manifest: {
        name: "Logru",
        short_name: "Logru",
        description: "カレンダーを土台に、使いたい機能だけを足して使うアプリ。",
        lang: "ja",
        start_url: "/",
        scope: "/",
        display: "standalone",
        background_color: "#e6ece8",
        theme_color: "#e6ece8",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//],
        // 書体は数が多いので先に全部は持たず、使ったものだけ残す
        globPatterns: ["**/*.{js,css,html,svg,png}"],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".woff2"),
            handler: "CacheFirst",
            options: { cacheName: "fonts", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 365 } },
          },
          {
            // 通信が切れたときに、最後に見た月を読むだけで出す。0012
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              url.pathname.startsWith("/api/") &&
              !url.pathname.startsWith("/api/auth") &&
              !url.pathname.startsWith("/api/dev"),
            handler: "NetworkFirst",
            options: {
              cacheName: "api",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 14 },
            },
          },
        ],
      },
    }),
  ],
  build: {
    // 書体は文字の範囲ごとに細かく分かれている。小さいものを CSS に埋め込むと、CSS が膨らむ
    assetsInlineLimit: (file) => (file.endsWith(".woff2") || file.endsWith(".woff") ? false : undefined),
  },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
