/** 機能の一覧の画面(ExtensionsPage)だけが使う API の hook */

import type { ExtensionOverview } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type Overview = { extensions: ExtensionOverview[]; personalGroupId: string | null };

const extensionsKeys = {
  overview: ["extension-overview"] as const,
};

/** 機能の一覧を、自分が使うかどうかと一緒に読む */
export function useExtensionOverview() {
  return useQuery({ queryKey: extensionsKeys.overview, queryFn: () => api<Overview>("/extensions") });
}

/** 機能を使うかどうかを切り替える。自分だけのグループの拡張の有効・無効を変える */
export function useToggleExtension(personalGroupId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, enabled }: { key: string; enabled: boolean }) =>
      api(`/groups/${personalGroupId}/extensions/${key}`, { method: "PUT", body: { enabled } }),
    onSuccess: (_r, v) => toast(v.enabled ? "使えるようにしました" : "使わないようにしました"),
    onError: (e) => toast.error((e as Error).message),
    // 入口の出し分けはグループの有効な拡張で決まるので、グループも読み直す
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: extensionsKeys.overview }),
        qc.invalidateQueries({ queryKey: keys.groups }),
      ]),
  });
}
