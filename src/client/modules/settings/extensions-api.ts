/** 設定の「機能」の画面(ExtensionsSettingsPage、ExtensionDetailPage)が使う API の hook */

import type { ExtensionOverview } from "@shared/api-types";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

export type ExtensionsOverview = { extensions: ExtensionOverview[]; personalGroupId: string | null };

/** このファイルの hook だけが使う読み込みキー */
const extensionsKeys = {
  overview: ["extension-overview"] as const,
};

/** 切り替えられる機能の一覧を、自分が使うかどうかと一緒に読む。F-24 */
export function useExtensionOverview() {
  return useQuery({ queryKey: extensionsKeys.overview, queryFn: () => api<ExtensionsOverview>("/extensions") });
}

/**
 * 拡張の有効・無効を、指定したグループで切り替える。自分だけのグループの ID を渡せば「自分で使う」の切り替えになり、
 * 共有のグループの ID を渡せば、そのグループで共有する切り替えになる。どちらも同じ API。0019、issue #102
 */
export function useSetExtensionEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, key, enabled }: { groupId: string; key: string; enabled: boolean }) =>
      api(`/groups/${groupId}/extensions/${key}`, { method: "PUT", body: { enabled } }),
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
