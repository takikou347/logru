/**
 * 版の食い違いを自分で見つけて直す。F-42、0089
 *
 * 起動時と、アプリに戻ってきた(visibilitychange)ときに、サーバーの今の版(GET /api/version、no-store)と
 * 自分の __APP_VERSION__ を比べる。違えば Service Worker に新しい版が無いか確かめさせる
 * (registration.update())。新しい Service Worker が制御を引き継げば、controllerchange を受けて
 * pwa-update.ts が読み込み直す。
 *
 * それでも版が合わないまま確かめ続けたら、この仕組み自体が効いていないとみなし、
 * pwa-reset.ts と同じやり方で Service Worker の登録と Cache Storage を全部消して読み直す。
 * 何度も繰り返さないよう、確かめ続けた回数は sessionStorage に持つ。
 */

import { hardResetAndReload } from "./pwa-reset";

const VERSION_PATH = "/api/version";
const MISMATCH_COUNT_KEY = "logru:pwa-version-mismatch-count";
/** この回数、版が合わないまま確かめ続けたら、全部消して読み直す */
export const MAX_MISMATCH_CHECKS = 3;

function readMismatchCount(): number {
  try {
    return Number(sessionStorage.getItem(MISMATCH_COUNT_KEY) ?? "0");
  } catch {
    return 0;
  }
}

function writeMismatchCount(n: number): void {
  try {
    if (n <= 0) sessionStorage.removeItem(MISMATCH_COUNT_KEY);
    else sessionStorage.setItem(MISMATCH_COUNT_KEY, String(n));
  } catch {
    // 使えない環境では数えない
  }
}

/**
 * サーバーの版と自分の版を比べ、次にすることを決める。
 * @param currentVersion 自分の __APP_VERSION__
 * @param serverVersion GET /api/version が返した値。読めなければ null
 * @param mismatchCount これまで確かめ続けて版が合わなかった回数
 */
export function decideVersionAction(
  currentVersion: string,
  serverVersion: string | null,
  mismatchCount: number,
): "ok" | "update" | "reset" {
  if (serverVersion === null || serverVersion === currentVersion) return "ok";
  return mismatchCount + 1 >= MAX_MISMATCH_CHECKS ? "reset" : "update";
}

async function fetchServerVersion(): Promise<string | null> {
  try {
    const res = await fetch(VERSION_PATH, { cache: "no-store" });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    const version = data && typeof data === "object" ? (data as { version?: unknown }).version : undefined;
    return typeof version === "string" ? version : null;
  } catch {
    return null;
  }
}

/** サーバーの版を確かめ、必要なら Service Worker に確かめさせるか、全部消して読み直す */
export async function checkVersion(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const serverVersion = await fetchServerVersion();
  const count = readMismatchCount();
  const action = decideVersionAction(__APP_VERSION__, serverVersion, count);
  if (action === "ok") {
    writeMismatchCount(0);
    return;
  }
  if (action === "reset") {
    writeMismatchCount(0);
    await hardResetAndReload();
    return;
  }
  writeMismatchCount(count + 1);
  const reg = await navigator.serviceWorker.getRegistration();
  try {
    await reg?.update();
  } catch {
    // 登録がちょうど外れた直後などに失敗することがある。次に確かめ直すだけでよい
  }
}

/** main.tsx で 1 度だけ呼ぶ */
export function listenVersionCheck(): void {
  void checkVersion();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") void checkVersion();
  });
}
