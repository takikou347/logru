/**
 * 立て替えの割り方。全員で同じ額、1 人ずつ金額を指定、割らない(払った人の負担)の 3 つ。0072、F-318
 */
export const KAKEIBO_SPLIT_MODES = ["equal", "custom", "none"] as const;

export type KakeiboSplitMode = (typeof KAKEIBO_SPLIT_MODES)[number];

/** 人ごとの負担額 1 件 */
export type KakeiboSplitShare = { userId: string; amount: number };

/**
 * 全員で同じ額に割る。0072
 *
 * 割り切れない 1 円は、払った人から順に、メンバーの並びに沿って 1 円ずつ足す。
 * 負担額の合計は、必ず渡した金額と同じになる。
 *
 * @param amount 記録の金額。円の整数
 * @param memberIds 割るグループのメンバー。記録したときのメンバー
 * @param payerId 払った人。memberIds に含まれていること
 */
export function splitEqually(amount: number, memberIds: string[], payerId: string): KakeiboSplitShare[] {
  const n = memberIds.length;
  if (n === 0) return [];
  const base = Math.floor(amount / n);
  const remainder = amount - base * n;
  // 払った人を先頭にし、残りはメンバーの並びのまま。先頭から remainder 人に 1 円ずつ足す
  const order = [payerId, ...memberIds.filter((id) => id !== payerId)];
  const extra = new Set(order.slice(0, remainder));
  return memberIds.map((userId) => ({ userId, amount: base + (extra.has(userId) ? 1 : 0) }));
}

/** 払った人だけの負担にする。割らない。0072 */
export function splitNone(amount: number, payerId: string): KakeiboSplitShare[] {
  return [{ userId: payerId, amount }];
}

/** 負担額の合計 */
export function sumSplitShares(shares: KakeiboSplitShare[]): number {
  return shares.reduce((n, s) => n + s.amount, 0);
}
