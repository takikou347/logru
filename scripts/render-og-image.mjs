// public/og-image.png を書き出す。LINE などへ貼ったときのカードに使う。1200 × 630。
// 見た目は 0010(ガラスとインクだまり、書体は Murecho)に沿う。render-icons.sh と同じく、手元で直したいときに直接流す。#93、#131
//
// 右のスマホのカレンダーに置く写真は scripts/assets/og-photo.jpg。Unsplash License、出どころは決定 0042 に書いた。
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = fileURLToPath(new URL("..", import.meta.url));
const icon = readFileSync(`${root}public/icon.svg`, "utf8");
const photoBase64 = readFileSync(`${root}scripts/assets/og-photo.jpg`).toString("base64");
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
.pool { position: absolute; border-radius: 50%; filter: blur(80px); }
.p1 { background: #3E9A6E; opacity: .5; width: 440px; height: 440px; left: -160px; top: -140px; }
.p2 { background: #F0A818; opacity: .48; width: 480px; height: 480px; right: -140px; top: -80px; }
.p3 { background: #2A9DB0; opacity: .42; width: 520px; height: 520px; left: 340px; bottom: -260px; }

/* 左: ロゴと大きな文。安全域(左右 100px が切れても読める範囲)は x:112-1088 */
.left {
  position: absolute;
  left: 112px;
  top: 0;
  width: 500px;
  height: 630px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 32px;
}
.brand { display: flex; align-items: center; gap: 16px; }
.mark { width: 52px; height: 52px; flex: none; }
.word { font-weight: 800; font-size: 34px; color: #17202C; letter-spacing: -0.01em; }
.headline {
  font-weight: 800;
  font-size: 46px;
  line-height: 1.5;
  color: #17202C;
  letter-spacing: -0.01em;
}

/* 右: スマホのカレンダーの一部。安全域は x:112-1088 */
.phone {
  position: absolute;
  left: 636px;
  top: 91px;
  width: 452px;
  height: 448px;
  border-radius: 40px;
  background: linear-gradient(180deg, rgba(255,255,255,.92), rgba(255,255,255,.8));
  border: 1px solid rgba(255,255,255,.85);
  box-shadow: inset 0 1px 0 rgba(255,255,255,.95), inset 0 -1px 0 rgba(23,32,44,.06), 0 40px 80px -30px rgba(23,32,44,.35);
  padding: 34px 36px;
  display: flex;
  flex-direction: column;
}
.phone-head { display: flex; align-items: baseline; justify-content: space-between; }
.month { font-weight: 800; font-size: 24px; color: #17202C; }
.weekrow { display: flex; gap: 13px; }
.wd { font-weight: 700; font-size: 15px; color: #8A94A3; width: 15px; text-align: center; }
.wd.sun { color: #C8402F; }
.wd.sat { color: #2D5FA8; }
.rule { height: 1px; background: rgba(23,32,44,.09); margin: 20px 0; }
.rows { display: flex; flex-direction: column; flex: 1; justify-content: space-between; }
.row { display: flex; align-items: center; gap: 20px; }
.badge {
  flex: none;
  width: 54px; height: 54px;
  border-radius: 15px;
  background: rgba(255,255,255,.65);
  border: 1px solid rgba(255,255,255,.9);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 1px;
}
.badge .wd2 { font-size: 12px; font-weight: 700; color: #8A94A3; }
.badge .num { font-size: 22px; font-weight: 800; color: #17202C; line-height: 1; }
.badge.sat .num { color: #2D5FA8; }
.badge.sun .num { color: #C8402F; }
.content { display: flex; flex-direction: column; gap: 5px; min-width: 0; }
.line1 { display: flex; align-items: center; gap: 9px; }
.dot { width: 11px; height: 11px; border-radius: 50%; background: #3E9A6E; flex: none; }
.time { font-weight: 800; font-size: 23px; color: #17202C; }
.label { font-weight: 500; font-size: 20px; color: #4A5563; }
.amount { font-weight: 800; font-size: 25px; color: #17202C; }
.yen {
  width: 26px; height: 26px; border-radius: 50%; flex: none;
  background: #6B4A2E; color: #fff; font-weight: 700; font-size: 15px;
  display: flex; align-items: center; justify-content: center;
}
.photo {
  width: 120px; height: 120px; border-radius: 24px; object-fit: cover;
  box-shadow: 0 10px 20px -10px rgba(23,32,44,.45);
}
.photo-label { font-weight: 500; font-size: 20px; color: #4A5563; }
</style>
</head>
<body>
  <div class="pools">
    <div class="pool p1"></div>
    <div class="pool p2"></div>
    <div class="pool p3"></div>
  </div>

  <div class="left">
    <div class="brand">${icon.replace("<svg ", '<svg class="mark" ')}<div class="word">Logru</div></div>
    <div class="headline">予定も、思い出も、<br />ひとつのカレンダーに。</div>
  </div>

  <div class="phone">
    <div class="phone-head">
      <div class="month">9月</div>
      <div class="weekrow">
        <div class="wd sun">日</div><div class="wd">月</div><div class="wd">火</div><div class="wd">水</div>
        <div class="wd">木</div><div class="wd">金</div><div class="wd sat">土</div>
      </div>
    </div>
    <div class="rule"></div>
    <div class="rows">
      <div class="row">
        <div class="badge"><span class="wd2">金</span><span class="num">19</span></div>
        <div class="content">
          <div class="line1"><span class="dot"></span><span class="time">19:00</span></div>
          <div class="label">ふたりで夕飯</div>
        </div>
      </div>
      <div class="row">
        <div class="badge sat"><span class="wd2">土</span><span class="num">20</span></div>
        <img class="photo" src="data:image/jpeg;base64,${photoBase64}" alt="" />
        <div class="photo-label">旅の一枚</div>
      </div>
      <div class="row">
        <div class="badge sun"><span class="wd2">日</span><span class="num">21</span></div>
        <div class="content">
          <div class="line1"><span class="yen">¥</span><span class="amount">3,400</span></div>
          <div class="label">夕食</div>
        </div>
      </div>
    </div>
  </div>
</body>
</html>`;

const browser = await chromium.launch({ headless: true, channel: "chrome" });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.setContent(html, { waitUntil: "networkidle" });
await page.screenshot({ path: out, clip: { x: 0, y: 0, width: 1200, height: 630 } });
await browser.close();
console.log(`wrote ${out}`);
