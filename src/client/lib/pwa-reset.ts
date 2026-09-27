/**
 * Service Worker の登録と Cache Storage を全部消す。F-42、0089
 *
 * 設定の「アプリを最新にする」と、版の食い違いが自分で直らないとき(pwa-version-check.ts)から呼ぶ。
 * `/api/reset.js`(古い版の Service Worker でも届く、素の JavaScript)と同じ処理を、
 * アプリの中からも呼べるようにしたもの。ログインの状態(IndexedDB)と端末の設定(localStorage)には触れない。
 */
export async function clearServiceWorkerAndCaches(): Promise<void> {
  if ("serviceWorker" in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  }
  // Cache API を持たない環境もある。api/client.ts の clearApiCache と同じ、任意の呼び出しにする
  const names = await caches?.keys();
  if (names) await Promise.all(names.map((n) => caches.delete(n)));
}

/**
 * この時間を超えて消せなくても、諦めて読み込み直す。
 *
 * Service Worker の登録は 1 つの待ち行列で順に処理される。ほかから呼んだ registration.update() が
 * 溜まっていると、unregister() がその後ろで待たされ、なかなか終わらないことがある。0089
 */
const CLEAR_TIMEOUT_MS = 3_000;

/**
 * 上を行い、「/」へ移る。中断すると次に開いたとき古いままなので、finally で必ず移る。
 *
 * すでに「/」にいるときは、`location.replace("/")` が同じ URL のままで読み込み直さないことがある。
 * その場合は `location.reload()` で確実に読み込み直す。0089
 */
export async function hardResetAndReload(): Promise<void> {
  try {
    await Promise.race([
      clearServiceWorkerAndCaches(),
      new Promise((resolve) => setTimeout(resolve, CLEAR_TIMEOUT_MS)),
    ]);
  } finally {
    const atHome = window.location.pathname === "/" && !window.location.search && !window.location.hash;
    if (atHome) window.location.reload();
    else window.location.replace("/");
  }
}
