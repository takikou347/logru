/**
 * よく使う記録を、記録した回数で並べるための数え。端末ごとに localStorage へ持つ。issue #280、0091
 *
 * サーバーには持たない。端末を替えると数え直しになる。読めない・壊れているときは、数えが無いものとして
 * 扱い、並びは元のまま(作った新しい順)になる。local-prefs.ts と同じ考え方
 */

const KEY = "logru-kakeibo-template-usage";

export type TemplateUsage = Record<string, number>;

/** 読めなければ空。形が壊れていても、正の整数の項目だけ拾う */
export function loadTemplateUsage(): TemplateUsage {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    const out: TemplateUsage = {};
    for (const [id, n] of Object.entries(value as Record<string, unknown>)) {
      if (typeof n === "number" && Number.isInteger(n) && n > 0) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

/** 記録するのに使ったよく使う記録の回数を 1 増やす。書き込めなくても、記録は続けられる */
export function countTemplateUse(id: string): void {
  try {
    const usage = loadTemplateUsage();
    usage[id] = (usage[id] ?? 0) + 1;
    localStorage.setItem(KEY, JSON.stringify(usage));
  } catch {
    // 数えられなくても、並びが元のままになるだけ
  }
}

/** 回数の多い順。同じ回数なら、渡された並びのまま。元の配列は変えない */
export function sortByUsage<T extends { id: string }>(items: readonly T[], usage: TemplateUsage): T[] {
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => (usage[b.item.id] ?? 0) - (usage[a.item.id] ?? 0) || a.index - b.index)
    .map((x) => x.item);
}
