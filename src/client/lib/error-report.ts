/**
 * 画面で起きた誤りをサーバーへ送る。0040
 *
 * window.onerror、unhandledrejection、ルートのエラー画面(RouteError)から呼ぶ。main.tsx で配線する。
 * 送る内容は URL のパス(クエリは含めない)、メッセージ、スタックの先頭、組み立ての版だけ。
 * 予定の中身や名前、メールアドレス、トークンは送らない。API は受けて console.error に出すだけで、何も保存しない。
 * 送るのに失敗しても、新たな誤りを起こさない。
 */

const REPORT_PATH = "/api/client-errors";
/** スタックはここまで。長いスタックの全体は送らない */
const STACK_LINES = 10;
const MESSAGE_MAX = 500;

/** 例外や、投げられた値から、報告に使うメッセージとスタックを取り出す */
export function describeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: error.message || error.name, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) ?? String(error) };
  } catch {
    return { message: String(error) };
  }
}

/** スタックの先頭だけを残す */
function truncateStack(stack: string | undefined): string | undefined {
  if (!stack) return undefined;
  return stack.split("\n").slice(0, STACK_LINES).join("\n");
}

/**
 * 誤りの報告を間引いて送る。
 *
 * 同じ文言は 1 分に 1 度まで、1 回の読み込みで 20 件まで。それを超えると静かに諦める。
 * テストでは、独自に構築してタイマーや上限を差し替えられるようクラスにする。実運用は `clientErrorReporter` を使う
 */
export class ClientErrorReporter {
  private sentCount = 0;
  private readonly lastSentAt = new Map<string, number>();

  /**
   * @param limitPerLoad 1 回の読み込みで送る上限
   * @param throttleMs 同じ文言を間引く間隔
   * @param now 現在時刻。テストで差し替える
   */
  constructor(
    private readonly limitPerLoad = 20,
    private readonly throttleMs = 60_000,
    private readonly now: () => number = Date.now,
  ) {}

  report(message: string, stack?: string): void {
    try {
      if (this.sentCount >= this.limitPerLoad) return;
      const at = this.now();
      const last = this.lastSentAt.get(message);
      if (last !== undefined && at - last < this.throttleMs) return;
      this.lastSentAt.set(message, at);
      this.sentCount += 1;
      send(message, stack);
    } catch {
      // 報告そのものが新たな誤りを起こさない
    }
  }
}

/** sendBeacon があれば使い、無ければ fetch で送る。届かなくても投げない */
function send(message: string, stack: string | undefined): void {
  const body = JSON.stringify({
    path: location.pathname,
    message: message.slice(0, MESSAGE_MAX),
    stack: truncateStack(stack),
    buildVersion: __APP_VERSION__,
  });
  try {
    if (navigator.sendBeacon?.(REPORT_PATH, new Blob([body], { type: "application/json" }))) return;
  } catch {
    // sendBeacon 自体が投げても fetch へまわす
  }
  fetch(REPORT_PATH, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
    () => {
      // 送れなくても、新たな誤りとしては扱わない
    },
  );
}

/** アプリ全体で使う 1 つの間引き。main.tsx と RouteError から呼ぶ */
export const clientErrorReporter = new ClientErrorReporter();
