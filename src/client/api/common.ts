/** 複数の機能が使う hook。1 つの機能に閉じるものは modules/<機能>/api.ts か extensions/<名前>/client/api.ts に置く */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GroupSummary, Me } from "@shared/api-types";
import { api } from "./client";
import { keys } from "./keys";

/**
 * 自分の情報と設定を読む。settings、calendar、groups など複数の画面が使う。
 * @param enabled ログインしているときだけ true にする
 */
export function useMe(enabled = true) {
  return useQuery({ queryKey: keys.me, queryFn: () => api<Me>("/me"), enabled });
}

/** 入っているグループを、メンバーと一緒に読む。calendar、groups、settings が使う */
export function useGroups() {
  return useQuery({
    queryKey: keys.groups,
    queryFn: () => api<{ groups: GroupSummary[] }>("/groups").then((r) => r.groups),
  });
}

/**
 * 自分の画面だけの色を変える。F-15、F-18。settings、calendar、groups が使う
 *
 * 押した瞬間に画面に効かせ、失敗したら元に戻して知らせる。color に null を渡すと既定の色に戻す。
 */
export function useColorPref() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ type, id, color }: { type: "group" | "user"; id: string; color: string | null }) =>
      color
        ? api(`/me/colors/${type}/${id}`, { method: "PUT", body: { color } })
        : api(`/me/colors/${type}/${id}`, { method: "DELETE" }),
    onMutate: async ({ type, id, color }) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) {
        const rest = prev.colorPrefs.filter((p) => !(p.targetType === type && p.targetId === id));
        qc.setQueryData<Me>(keys.me, { ...prev, colorPrefs: color ? [...rest, { targetType: type, targetId: id, color }] : rest });
      }
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}
