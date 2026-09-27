import { createRouter } from "@server/core/app";

/**
 * 「最新の版にしています…」の画面。/api/reset.js を読んで、Service Worker の登録と
 * Cache Storage を消してから「/」へ移る。Murecho を読み込まないので、CSS は当てない。F-42、0089
 */
const RESET_HTML = `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Logru</title>
</head>
<body>
<p>最新の版にしています…</p>
<script src="/api/reset.js"></script>
</body>
</html>
`;

/**
 * Service Worker の登録をすべて外し、Cache Storage をすべて消してから「/」へ移る。
 *
 * ログインの状態(Firebase の IndexedDB)と、端末の設定(localStorage)には触れない。
 * どちらかで失敗しても、finally で必ず「/」へ移る。
 *
 * Service Worker の登録は 1 つの待ち行列で順に処理されるので、ほかから呼んだ update() が
 * 溜まっていると unregister() がなかなか終わらないことがある。3 秒待って進む。F-42、0089
 */
const RESET_SCRIPT = `(async () => {
  const clear = (async () => {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in self) {
      const names = await caches.keys();
      await Promise.all(names.map((n) => caches.delete(n)));
    }
  })();
  try {
    await Promise.race([clear, new Promise((r) => setTimeout(r, 3000))]);
  } finally {
    location.replace("/");
  }
})();
`;

/**
 * `/api/reset`、`/api/reset.js`、`/api/version`。ログインは求めない。F-42、0089
 *
 * `/api/` の下に置くので、workbox の navigateFallbackDenylist に当たり、古い版の Service Worker が
 * 残っていても、index.html の代わりにここへ届く。DB を読まず、返す内容は組み立て時に決まっているので、
 * 呼ばれる回数に上限は掛けない。0065
 */
export const pwaRoutes = createRouter()
  .get("/reset", (c) => c.html(RESET_HTML, 200, { "Cache-Control": "no-store" }))
  .get("/reset.js", (c) =>
    c.body(RESET_SCRIPT, 200, {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-store",
    }),
  )
  .get("/version", (c) => c.json({ version: __APP_VERSION__ }, 200, { "Cache-Control": "no-store" }));
