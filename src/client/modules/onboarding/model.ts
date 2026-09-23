/** はじめての案内の決まり。画面に依らないものだけを置く。F-32、0035 */

/** 設定の「はじめての案内をもう一度見る」から開くときに、カレンダーの URL に付ける印 */
export const REOPEN_PARAM = "onboarding";

/** E2E で、ほかのテストの邪魔をしないよう案内を出さない印。エミュレーターにつないだ組み立てでだけ読む */
export const E2E_SKIP_KEY = "logru-e2e-skip-onboarding";

/**
 * 案内を出すか。見終えていない人か、設定から開き直したときに出す。
 * @param onboardedAt 見終えたか飛ばした日時。null ならまだ
 * @param reopen 設定から開き直したか
 */
export function shouldShowOnboarding(onboardedAt: number | null, reopen: boolean): boolean {
  return reopen || onboardedAt === null;
}

/**
 * 貼られた招待リンクから、招待の文字列を取り出す。URL でも、`/invite/` からのパスでもよい。
 * 取り出せなければ null。
 */
export function inviteTokenOf(text: string): string | null {
  const m = /\/invite\/([A-Za-z0-9_-]{16,})\/?(?:[?#].*)?$/.exec(text.trim());
  return m?.[1] ?? null;
}
