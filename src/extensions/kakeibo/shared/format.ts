/**
 * 金額を `¥1,200` の形に整える。マイナスは `-¥1,200` にする。カードの残高など、マイナスを許す値で使う。
 * 画面とカレンダーの項目の題名の両方で使う
 */
export function formatYen(amount: number): string {
  const sign = amount < 0 ? "-" : "";
  return `${sign}¥${Math.abs(amount).toLocaleString("ja-JP")}`;
}

/** 収入の行で使う、符号付きの金額。`+¥1,200` の形にする。F-303 */
export function formatSignedYen(amount: number): string {
  return amount < 0 ? formatYen(amount) : `+${formatYen(amount)}`;
}

/**
 * 家計簿の日付(`2026-09-22` の形)を「9月22日」の形にする。曜日は付けない。決定 0059、0072
 *
 * 土台の `@/lib/dates` の `formatShortDate` と同じ書き方にそろえる。PR #187 が develop へ入って
 * `formatShortDate` がこの形に変わったら、そちらを直に呼ぶ形へ寄せてよい。それまでの間は、
 * ここで文字列のまま組み立て、日付を書き方が変わる前の `formatShortDate`(`9.22` の形)には頼らない
 * @param opts.year true なら `2026年9月22日` にする
 */
export function formatKakeiboDate(date: string, opts?: { year?: boolean }): string {
  const [y, m, d] = date.split("-").map(Number);
  const year = opts?.year ? `${y}年` : "";
  return `${year}${m}月${d}日`;
}

/**
 * 期間の見出し。同じ日なら 1 つ、違えば「9月19日〜9月20日」につなぐ。年が違えばそれぞれに年を付ける。F-323、F-324
 */
export function formatKakeiboDateSpan(from: string, to: string): string {
  if (from === to) return formatKakeiboDate(from);
  const withYear = from.slice(0, 4) !== to.slice(0, 4) ? { year: true } : undefined;
  return `${formatKakeiboDate(from, withYear)}〜${formatKakeiboDate(to, withYear)}`;
}
