/**
 * 下のタブの帯の「+」の放射の上に出す、よく使う記録。0091、issue #239
 *
 * よく使う記録(F-326、kakeibo_templates)を、この端末で記録した回数の多い順に並べる(template-usage.ts、
 * issue #280)。同じ回数なら、作った新しい順。上位から数件だけ出す。押すと、家計簿の記録のシートがその記録を当てた状態で開く(ExpenseSheet の
 * initialTemplateId。中のチップを押すのと同じ経路)。
 *
 * 金額まで決まっていて、1 回で保存できるだけ欄が埋まっている記録は、長押しでシートを開かずに今日の日付で
 * 保存し、5 秒の「元に戻す」を出す(quickSave)。0102、issue #312
 */
import type { FavoriteAdd } from "@extensions/client/types";
import { Coins } from "lucide-react";
import { toast } from "sonner";
import { useMe } from "@/api/common";
import { dateKey } from "@/lib/dates";
import { vibrateShort } from "@/lib/haptics";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { formatYen } from "../shared/format";
import {
  type KakeiboSaveInput,
  type KakeiboTemplate,
  useDeleteExpense,
  useKakeiboGroups,
  useKakeiboTemplates,
  useSaveExpense,
} from "./api";
import { countTemplateUse, loadTemplateUsage, sortByUsage } from "./template-usage";

const MAX_FAVORITE_ADDS = 3;

/**
 * 1 回で保存できる入力にする。足りなければ null(長押しでもシートを開く)。
 * 金額・カテゴリが決まっていて、振替ではないものだけ。共有のグループで口座も決まっているものは、
 * 立て替えの扱いを口座から決めるので、ここでは決めずにシートへ回す
 */
export function quickSaveInput(
  t: KakeiboTemplate,
  groups: { id: string; isPersonal: boolean }[],
  meId: string,
  date: string,
): KakeiboSaveInput | null {
  if (t.type === "transfer" || t.amount === null || t.category === null) return null;
  const group = groups.find((g) => g.id === t.groupId) ?? groups.find((g) => g.isPersonal);
  if (!group) return null;
  const base: KakeiboSaveInput = {
    type: t.type,
    groupId: group.id,
    date,
    amount: t.amount,
    category: t.category,
    // 自分だけのグループに替えたときは、元のグループの口座を持ち込まない(サーバーが 400 で止める)
    accountId: group.id === t.groupId ? t.accountId : null,
    memo: t.memo,
  };
  if (group.isPersonal || t.type !== "expense") return base;
  if (t.accountId) return null;
  return { ...base, paidBy: meId, splitMode: "equal" };
}

export function useKakeiboFavoriteAdds(enabled: boolean): FavoriteAdd[] | null {
  const templates = useKakeiboTemplates(enabled);
  const me = useMe();
  const { groups } = useKakeiboGroups();
  const saveExpense = useSaveExpense();
  const deleteExpense = useDeleteExpense();
  // 保存したあと 5 秒だけ「元に戻す」を出す。記録は残したままで、押したときだけ消す(RecurringsPage と同じ型)
  const { remove: showUndo } = useUndoableDelete("記録した", (id) => {
    void deleteExpense.mutateAsync({ id });
  });
  const meId = me.data?.user.id;
  const data = templates.data;
  if (!enabled || !data || data.length === 0) return null;
  return sortByUsage(data, loadTemplateUsage())
    .slice(0, MAX_FAVORITE_ADDS)
    .map((t) => {
      const input = meId ? quickSaveInput(t, groups, meId, dateKey(new Date())) : null;
      return {
        key: t.id,
        label: t.amount === null ? t.name : `${t.name} ${formatYen(t.amount)}`,
        icon: Coins,
        path: `/kakeibo?record=1&template=${t.id}`,
        quickSave: input
          ? async () => {
              try {
                // 長押しを離すまでの間に日付をまたいでも、押した瞬間ではなく保存の時点の今日にする
                const saved = await saveExpense.mutateAsync({ body: { ...input, date: dateKey(new Date()) } });
                countTemplateUse(t.id);
                vibrateShort();
                showUndo(saved.id, async () => {}, {
                  message: `${t.name} ${input.amount.toLocaleString("ja-JP")} 円を記録した`,
                });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }
          : undefined,
      };
    });
}
