/** 期間の予算のうち、家計簿の画面の上に出すものを選ぶ。0072、F-323、F-324 */

/** 予算 1 件のうち、この並べ替えに要る項目 */
export type BudgetSpan = { startDate: string; endDate: string };

/**
 * 今日を含む予算と、これからの予算だけを、始まりの日が早い順に返す。終わった予算(終わりの日が今日より前)は出さない。
 * @param today `2026-09-24` の形の今日
 */
export function upcomingOrCurrentBudgets<T extends BudgetSpan>(budgets: T[], today: string): T[] {
  return budgets.filter((b) => b.endDate >= today).sort((a, b) => a.startDate.localeCompare(b.startDate));
}
