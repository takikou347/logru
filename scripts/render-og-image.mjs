// public/og-image.png を書き出す。LINE などへ貼ったときのカードに使う。1200 × 630、写真は使わない。
// 見た目は 0010(ガラスとインクだまり、書体は Murecho)に沿う。render-icons.sh と同じく、手元で直したいときに直接流す。#93
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const icon = readFileSync(`${root}public/icon.svg`, "utf8");
const fontsDir = `file://${root}node_modules/@fontsource-variable/murecho/files`;
const out = `${root}public/og-image.png`;

const html = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<style>
@font-face {
  font-family: "Murecho Variable";
  font-weight: 100 900;
  src: url("${fontsDir}/murecho-latin-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}
@font-face {
  font-family: "Murecho Variable";
  font-weight: 100 900;
  src: url("${fontsDir}/murecho-63-wght-normal.woff2") format("woff2-variations");
  unicode-range: U+3041-3096, U+309D-309F, U+30A1-30FA, U+30FC-30FF, U+31F0-31FF, U+FF66-FF9F;
}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1200px; height: 630px; overflow: hidden; }
body {
  position: relative;
  background: #E6ECE8;
  font-family: "Murecho Variable", sans-serif;
  font-feature-settings: "tnum";
  isolation: isolate;
}
.pools { position: absolute; inset: 0; z-index: -1; }
.pool { position: absolute; border-radius: 50%; filter: blur(70px); }
.p1 { background: #3E9A6E; opacity: .55; width: 460px; height: 460px; left: -140px; top: -120px; }
.p2 { background: #F0A818; opacity: .5; width: 520px; height: 520px; right: -160px; top: 140px; }
.p3 { background: #2A9DB0; opacity: .45; width: 420px; height: 420px; left: 260px; bottom: -220px; }
.card {
  position: absolute;
  left: 80px; top: 95px;
  width: 760px; height: 440px;
  border-radius: 40px;
  background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.82));
  border: 1px solid rgba(255,255,255,.85);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(23,32,44,.06), 0 40px 80px -30px rgba(23,32,44,.35);
  padding: 72px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
}
.brand { display: flex; align-items: center; gap: 22px; }
.mark { width: 88px; height: 88px; flex: none; }
.word { font-weight: 800; font-size: 76px; color: #17202C; letter-spacing: -0.01em; }
.tagline { font-weight: 500; font-size: 32px; line-height: 1.55; color: #4A5563; max-width: 600px; }
</style>
</head>
<body>
  <div class="pools">
    <div class="pool p1"></div>
    <div class="pool p2"></div>
    <div class="pool p3"></div>
  </div>
  <div class="card">
    <div class="brand">${icon.replace("<svg ", '<svg class="mark" ')}<div class="word">Logru</div></div>
    <div class="tagline">カレンダーを土台に、<br />使いたい機能だけを足して使うアプリ。</div>
  </div>
</body>
</html>`;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote ${out}`);
