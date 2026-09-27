/** 複数の機能が使う hook。1 つの機能に閉じるものは modules/<機能>/api.ts か extensions/<名前>/client/api.ts に置く */

import type { GroupSummary, Me } from "@shared/api-types";
import { addTourSeen } from "@shared/tours";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
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
        qc.setQueryData<Me>(keys.me, {
          ...prev,
          colorPrefs: color ? [...rest, { targetType: type, targetId: id, color }] : rest,
        });
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

/**
 * 見た画面の一覧を、押した瞬間に書き換える。失敗したら元に戻す。F-33
 * @param next いまの一覧から次の一覧を作る
 */
function setToursSeen(qc: ReturnType<typeof useQueryClient>, next: (seen: string[]) => string[]) {
  const prev = qc.getQueryData<Me>(keys.me);
  if (prev)
    qc.setQueryData<Me>(keys.me, { ...prev, settings: { ...prev.settings, toursSeen: next(prev.settings.toursSeen) } });
  return { prev };
}

/**
 * 画面の案内を見たことを残す。別の端末でも出なくなる。F-33。calendar、groups、extensions と拡張の画面が使う
 * 失敗しても知らせない。案内がもう一度出るだけで、困ることは無い
 */
export function useMarkTourSeen() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ toursSeen: string[] }>(`/me/tours/${id}`, { method: "PUT", keepalive: true }),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: keys.me });
      return setToursSeen(qc, (seen) => addTourSeen(seen, id));
    },
    onError: (_e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
    },
  });
}

/**
 * 足した機能のタイルの並びを変える。押した瞬間に画面に効かせ、失敗したら元に戻す。0058
 * FeatureSheet と、設定の「機能」の両方が使う
 */
export function useSetExtensionOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (order: string[]) =>
      api<{ extensionOrder: string[] }>("/me/extension-order", { method: "PUT", body: { order } }),
    onMutate: async (order) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) qc.setQueryData<Me>(keys.me, { ...prev, settings: { ...prev.settings, extensionOrder: order } });
      return { prev };
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

/**
 * いつもの共有先を決める。null は「共有しない」を選ぶ。押した瞬間に画面に効かせ、失敗したら元に戻す。0063、F-40
 * 設定の「いつもの共有先」の行と、1 回だけ聞く帯(UsualShareOfferBanner)の両方が使う
 */
export function useSetUsualShare() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string | null) =>
      api<{ usualShareGroupId: string | null; usualShareAskedAt: number }>("/me/usual-share", {
        method: "PUT",
        body: { groupId },
      }),
    onMutate: async (groupId) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) {
        qc.setQueryData<Me>(keys.me, {
          ...prev,
          settings: { ...prev.settings, usualShareGroupId: groupId },
          usualShareAskedAt: Date.now(),
        });
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

/** 画面の案内をもう一度出す。見た画面の一覧を空にする。F-33 */
export function useResetTours() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ toursSeen: string[] }>("/me/tours", { method: "DELETE" }),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: keys.me });
      return setToursSeen(qc, () => []);
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
      toast.error((e as Error).message);
    },
  });
}
