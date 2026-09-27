/** 拡張を足す・外す画面(ExtensionAddPage、ExtensionDetailPage、ExtensionTileGrid)が使う API の hook */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/api/client";
import { keys } from "@/api/keys";

/**
 * 拡張の足す・外すを、指定したグループで切り替える。自分だけのグループの ID を渡せば「自分に足す」の切り替えになり、
 * 共有のグループの ID を渡せば、そのグループで共有する切り替えになる。どちらも同じ API。0019、issue #102、0058
 *
 * 成功したときの言葉は、呼ぶ側で決める(足す画面は最初の一歩も添えた知らせを出す、外すときは短い知らせだけ、
 * グループの切り替えでは知らせを出す、など呼び先ごとに違うため)。ここでは出さない
 */
export function useSetExtensionEnabled() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, key, enabled }: { groupId: string; key: string; enabled: boolean }) =>
      api(`/groups/${groupId}/extensions/${key}`, { method: "PUT", body: { enabled } }),
    onError: (e) => toast.error((e as Error).message),
    // 入口の出し分けはグループの有効な拡張で決まるので、グループを読み直す
    onSettled: () => qc.invalidateQueries({ queryKey: keys.groups }),
  });
}
