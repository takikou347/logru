import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

/** 組み立ての版。画面の誤りの報告に載せる。git が無い環境では "dev" にする。0040 */
function buildVersion(): string {
  try {
    return execSync("git rev-parse --short HEAD").toString().trim();
  } catch {
    return "dev";
  }
}

/**
 * public/_headers の CSP に、Firebase の行き先を入れる。
 *
 * Google でのログインは、認証用のドメインを iframe で開く。ドメインは組み立てる設定ごとに違うので、
 * 組み立てた後の _headers の印を置き換える。エミュレーターは、つなぐ設定のときだけ許す。
 */
function firebaseCsp(env: Record<string, string>): Plugin {
  const emulator = env.VITE_FIREBASE_AUTH_EMULATOR_URL ?? "";
  // 認証用のドメインを書かない組み立ては、アプリと同じドメインを使う。#1
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN ? `https://${env.VITE_FIREBASE_AUTH_DOMAIN}` : "'self'";
  const frame = [authDomain, "https://apis.google.com", emulator].filter(Boolean).join(" ");
  return {
    name: "logru-firebase-csp",
    apply: "build",
    async writeBundle(options) {
      if (!options.dir) return;
      const file = join(options.dir, "_headers");
      const text = await readFile(file, "utf8").catch(() => null);
      if (text === null) return;
      await writeFile(file, text.replace("__FIREBASE_CONNECT__", emulator).replace("__FIREBASE_FRAME__", frame));
    },
  };
}

export default defineConfig(({ mode }) => ({
  define: { __APP_VERSION__: JSON.stringify(buildVersion()) },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@server": fileURLToPath(new URL("./src/server", import.meta.url)),
      "@extensions": fileURLToPath(new URL("./src/extensions", import.meta.url)),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    cloudflare(),
    firebaseCsp(loadEnv(mode, process.cwd(), "VITE_FIREBASE_")),
    VitePWA({
      registerType: "autoUpdate",
      // CSP でインラインのスクリプトを許さないので、登録は別ファイルにする
      injectRegister: "script",
      includeAssets: ["icon.svg", "apple-touch-icon.png", "theme-boot.js", "push-sw.js"],
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
        // 端末への知らせを受ける処理。0023
        importScripts: ["/push-sw.js"],
        navigateFallback: "/index.html",
        // 認証の通り道は Worker が Firebase へ中継する。画面の代わりに index.html を返さない。#1
        navigateFallbackDenylist: [/^\/api\//, /^\/__\//],
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
            urlPattern: ({ url, request }) => request.method === "GET" && url.pathname.startsWith("/api/"),
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
}));
