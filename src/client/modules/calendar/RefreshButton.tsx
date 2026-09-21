import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { clientExtensions } from "../../../extensions/registry.client";
import { Button } from "@/components/ui/button";
import { keys } from "@/lib/queries";
import { cn } from "@/lib/utils";

/**
 * カレンダーを読み直す。
 * 先に各拡張の refresh（外部のカレンダーの読み直しなど）を並べて待ち、それからカレンダー、グループ、自分の情報を読み直す。
 * いまは画面が自動で追いかけないので、グループのほかの人が足した予定も、これで出せる。
 * @returns 読めなかったものの名前
 */
async function refreshAll(qc: ReturnType<typeof useQueryClient>): Promise<string[]> {
  const results = await Promise.allSettled(clientExtensions.map((x) => x.refresh?.() ?? Promise.resolve({ failed: [] })));
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["calendar"] }),
    qc.invalidateQueries({ queryKey: keys.groups }),
    qc.invalidateQueries({ queryKey: keys.me }),
  ]);
  const failed: string[] = [];
  for (const [i, r] of results.entries()) {
    if (r.status === "fulfilled") failed.push(...r.value.failed);
    else failed.push(clientExtensions[i]!.manifest.label);
  }
  return failed;
}

/** カレンダーの画面の上の帯に置く、読み直しのボタン。読み直している間は回り、押せない */
export function RefreshButton() {
  const qc = useQueryClient();
  const refresh = useMutation({
    mutationFn: () => refreshAll(qc),
    onSuccess: (failed) => {
      if (failed.length) toast.error(`カレンダーを読み直しました。読めなかったもの: ${failed.join("、")}`);
      else toast("カレンダーを読み直しました");
    },
    onError: (e) => toast.error((e as Error).message),
  });
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="カレンダーを読み直す"
      title="カレンダーを読み直す"
      aria-busy={refresh.isPending}
      disabled={refresh.isPending}
      onClick={() => refresh.mutate()}
    >
      <RefreshCw className={cn("size-5", refresh.isPending && "animate-spin")} />
    </Button>
  );
}
