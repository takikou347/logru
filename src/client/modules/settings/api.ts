/** 設定の各節の画面(AppearanceSettingsPage、AccountSettingsPage、DeleteAccountSheet、PushSection)が使う API の hook */

import type { AvatarKind, Me, PushInfo } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";
import { auth } from "@/lib/firebase";
import { applyTheme } from "@/lib/theme";

/**
 * アバターの写真を送る。JPEG に整えた Blob を multipart/form-data で送る。#40
 *
 * avatarUrl は AVATAR_PHOTO_KEY が置かれていなければ null。写真は置けても、署名した URL は作れないため。頭文字に戻して見せる
 */
async function uploadAvatarPhoto(photo: Blob): Promise<{ avatarKind: AvatarKind; avatarUrl: string | null }> {
  const token = await auth.currentUser?.getIdToken();
  const form = new FormData();
  form.set("photo", photo, "avatar.jpg");
  const res = await fetch("/api/me/avatar", {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    avatarKind?: AvatarKind;
    avatarUrl?: string | null;
  };
  if (!res.ok) throw new Error(data.error ?? "写真を送れませんでした。もう一度試してください。");
  return { avatarKind: data.avatarKind ?? "photo", avatarUrl: data.avatarUrl ?? null };
}

/** アバターに写真を置く。押した瞬間に画面に効かせる。#40 */
export function useUploadAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadAvatarPhoto,
    onSuccess: (result) => {
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) {
        qc.setQueryData<Me>(keys.me, {
          ...prev,
          user: { ...prev.user, avatarUrl: result.avatarUrl },
          settings: { ...prev.settings, avatarKind: result.avatarKind },
        });
      }
    },
    // 呼ぶ側(AvatarSection)が mutateAsync を try/catch していて、そこでも知らせを出す。ここでは出さない。二重に出ないように
    // 自分のアバターは、グループのメンバーの一覧にも出る
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/** アバターを頭文字に戻す。置いていた写真は消える。#40 */
export function useResetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ avatarKind: AvatarKind; avatarUrl: null }>("/me/avatar", { method: "DELETE" }),
    onSuccess: (result) => {
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) {
        qc.setQueryData<Me>(keys.me, {
          ...prev,
          user: { ...prev.user, avatarUrl: result.avatarUrl },
          settings: { ...prev.settings, avatarKind: result.avatarKind },
        });
      }
    },
    // AvatarSection の try/catch が知らせを出すので、ここでは出さない
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

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
      await qc.cancelQueries({ queryKey: keys.me });
      applyTheme(next.themeMode, next.bgTheme, next.accentColor);
      const prev = qc.getQueryData<Me>(keys.me);
      if (prev) qc.setQueryData<Me>(keys.me, { ...prev, settings: next });
      return { prev };
    },
    onError: (e, _n, ctx) => {
      if (ctx?.prev) {
        qc.setQueryData(keys.me, ctx.prev);
        applyTheme(ctx.prev.settings.themeMode, ctx.prev.settings.bgTheme, ctx.prev.settings.accentColor);
      }
      toast.error((e as Error).message);
    },
    // 自分の色は、自分だけのグループの色でもある
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}

/**
 * 表示名を変える。useColorPref と同じ形: 押した瞬間に画面に効かせ、失敗したら元に戻す。
 * 失敗の知らせは呼び出し側(NameRow)が入力欄のそばに出すので、ここでは toast を出さない
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
    onError: (_e, _n, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.me, ctx.prev);
    },
    // 表示名は me だけでなく、メンバーの一覧や人の絞り込みで groups と calendar にも出る。3 つとも読み直す
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.me });
      qc.invalidateQueries({ queryKey: keys.groups });
      qc.invalidateQueries({ queryKey: ["calendar"] });
    },
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
