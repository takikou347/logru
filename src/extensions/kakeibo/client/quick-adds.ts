/**
 * 下のタブの帯の「+」の放射の上に出す、よく使う記録。0091、issue #239
 *
 * よく使う記録(F-326、kakeibo_templates)を、この端末で記録した回数の多い順に並べる(template-usage.ts、
 * issue #280)。同じ回数なら、作った新しい順。上位から数件だけ出す。押すと、家計簿の記録のシートがその記録を当てた状態で開く(ExpenseSheet の
 * initialTemplateId。中のチップを押すのと同じ経路)。
 */
import type { FavoriteAdd } from "@extensions/client/types";
import { Coins } from "lucide-react";
import { formatYen } from "../shared/format";
import { useKakeiboTemplates } from "./api";
import { loadTemplateUsage, sortByUsage } from "./template-usage";

const MAX_FAVORITE_ADDS = 3;

export function useKakeiboFavoriteAdds(enabled: boolean): FavoriteAdd[] | null {
  const templates = useKakeiboTemplates(enabled);
  const data = templates.data;
  if (!enabled || !data || data.length === 0) return null;
  return sortByUsage(data, loadTemplateUsage())
    .slice(0, MAX_FAVORITE_ADDS)
    .map((t) => ({
      key: t.id,
      label: t.amount === null ? t.name : `${t.name} ${formatYen(t.amount)}`,
      icon: Coins,
      path: `/kakeibo?record=1&template=${t.id}`,
    }));
}
