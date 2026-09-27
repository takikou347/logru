/**
 * 下のタブの帯の「+」の放射の上に出す、よく使う記録。0091、issue #239
 *
 * 使用頻度を数える仕組みは無いので、よく使う記録(F-326、kakeibo_templates)の並びをそのまま使う。
 * 上位から数件だけ出す。押すと、家計簿の記録のシートがその記録を当てた状態で開く(ExpenseSheet の
 * initialTemplateId。中のチップを押すのと同じ経路)。
 */
import type { FavoriteAdd } from "@extensions/client/types";
import { Coins } from "lucide-react";
import { formatYen } from "../shared/format";
import { useKakeiboTemplates } from "./api";

const MAX_FAVORITE_ADDS = 3;

export function useKakeiboFavoriteAdds(enabled: boolean): FavoriteAdd[] | null {
  const templates = useKakeiboTemplates(enabled);
  const data = templates.data;
  if (!enabled || !data || data.length === 0) return null;
  return data.slice(0, MAX_FAVORITE_ADDS).map((t) => ({
    key: t.id,
    label: t.amount === null ? t.name : `${t.name} ${formatYen(t.amount)}`,
    icon: Coins,
    path: `/kakeibo?record=1&template=${t.id}`,
  }));
}
