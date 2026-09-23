/** 家計簿の画面で使い回す部品 */

/**
 * 月を `2026-09` の形にする。画面は端末の時間帯で月を選ぶ。
 * @param d 月の中の 1 日
 */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** `2026-09` の形を、月の初日の Date にする */
function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1);
}

/** n か月後の月。月の初日を返す */
export function addMonthsToKey(key: string, n: number): string {
  const d = parseMonthKey(key);
  return monthKeyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** `2026年9月` の形の見出し */
export function formatMonthLabel(key: string): string {
  const d = parseMonthKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}
