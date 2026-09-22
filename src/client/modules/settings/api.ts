/** 設定の画面(SettingsPage、DeleteAccountSheet、PushSection)が使う API の hook */

import type { Me, PushInfo } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { applyTheme } from "@/lib/theme";

/** このファイルの hook だけが使う読み込みキー */
const settingsKeys = {
  deletion: ["me", "deletion"] as const,
  push: ["push"] as const,
};

/** 明るさ、テーマカラー、自分の色などの見た目の設定を変える。押してすぐ画面に効かせる */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    // 押してすぐ読み込み直しても、保存を途中で切らせない
    mutationFn: (next: Me["settings"]) =>
      api<Me["settings"]>("/me/settings", { method: "PUT", body: next, keepalive: true }),
    onMutate: async (next) => {
      applyTheme(next.themeMode, next.accentColor);
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) qc.setQueryData<Me>(keys.me, { ...prev, settings: next });
      return { prev };
    },
    onError: (e, _n, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(keys.me, ctx.prev);
        applyTheme(ctx.prev.settings.themeMode, ctx.prev.settings.accentColor);
      }
      toast.error((e as Error).message);
    },
    // 自分の色は、自分だけのグループの色でもある
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/**
 * 表示名を変える。useColorPref と同じ形: 押した瞬間に画面に効かせ、失敗したら元に戻して知らせる
 */
export function useUpdateName() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => api("/me", { method: "PATCH", body: { name } }),
    onMutate: async (name) => {
      await qc.cancelQueries({ queryKey: keys.me });
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) qc.setQueryData<Me>(keys.me, { ...prev, user: { ...prev.user, name } });
      return { prev };
    },
    onError: (e, _n, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
      toast.error((e as Error).message);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: keys.me }),
  });
}

/** `GET /api/me/deletion` の応答 */
export type DeletionCheck = { ok: boolean; blocked: string[]; message: string | null };

/** アカウントを消せるか、消す前にサーバーに聞く */
export function useDeletionCheck() {
  return useQuery({ queryKey: settingsKeys.deletion, queryFn: () => api<DeletionCheck>("/me/deletion"), staleTime: 0 });
}

/** アカウントを消す。D1 の自分のデータを消す */
export function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirm: string) => api("/me", { method: "DELETE", body: { confirm } }),
  });
}

/** この端末の通知の設定を読む */
export function usePushInfo() {
  return useQuery({ queryKey: settingsKeys.push, queryFn: () => api<PushInfo>("/me/push") });
}

/** この端末の通知の設定を読み直させる。enablePush/disablePush はブラウザーの Push API を直接使うので、ここでは呼び出さない */
export function useInvalidatePushInfo() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: settingsKeys.push });
}
