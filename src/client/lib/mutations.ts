import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Me } from "../../shared/api-types";
import { api } from "./api";
import { keys } from "./queries";

/**
 * 自分の画面だけの色を変える。F-15、F-18
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
