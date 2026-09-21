import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { ExternalCalendarSummary } from "../shared/schemas";
import { EXTERNAL_CALENDARS_KEY, useExternalCalendars } from "./queries";

/**
 * カレンダーの画面の上の帯に置く、外部のカレンダーを読み直すボタン。
 * 外部のカレンダーを 1 つ以上登録している人にだけ出す。押すと、登録したものをすべて読み直してから、カレンダーを読み直す。
 */
export function ExternalRefreshButton() {
  const qc = useQueryClient();
  const calendars = useExternalCalendars();
  const sync = useMutation({
    mutationFn: () => api<{ calendars: ExternalCalendarSummary[] }>("/external-calendars/sync", { method: "POST" }),
    onSuccess: ({ calendars: list }) => {
      qc.setQueryData(EXTERNAL_CALENDARS_KEY, list);
      const failed = list.filter((c) => c.lastError);
      if (failed.length) toast.error(`読めなかったカレンダーがあります: ${failed.map((c) => c.name).join("、")}`);
      else toast("外部のカレンダーを読み直しました");
    },
    onError: (e) => toast.error((e as Error).message),
    onSettled: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });

  if (!calendars.data?.length) return null;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="外部のカレンダーを読み直す"
      aria-busy={sync.isPending}
      disabled={sync.isPending}
      onClick={() => sync.mutate()}
    >
      <RefreshCw className={cn("size-5", sync.isPending && "animate-spin")} />
    </Button>
  );
}
