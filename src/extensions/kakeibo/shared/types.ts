/** 記録の種類。支出、収入、振替の 3 つだけ。0069 */
export const KAKEIBO_TYPES = ["expense", "income", "transfer"] as const;

export type KakeiboType = (typeof KAKEIBO_TYPES)[number];
