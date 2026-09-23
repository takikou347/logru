/** リストの画面で使い回す部品 */

/** `2026-09-22` を `9.22` の形にする */
export function formatShortDate(date: string): string {
  return date.slice(5).replace("-", ".");
}
