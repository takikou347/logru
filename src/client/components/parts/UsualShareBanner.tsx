import type { GroupSummary, Me } from "@shared/api-types";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useSetUsualShare } from "@/api/common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 共有のグループが 1 つだけの人に、そのグループを「いつもの共有先」にするか 1 回だけ聞く帯。0063、F-40
 *
 * 答える(する・しない のどちらでも)と usualShareAskedAt が付き、二度と出さない。
 * グループが 2 つ以上になっても、まだ聞いていなければ出さない。1 つだけのときに決めてほしいため
 */
export function UsualShareOfferBanner({
  me,
  groups,
  className,
}: {
  me: Me;
  groups: GroupSummary[];
  className?: string;
}) {
  const setUsual = useSetUsualShare();
  const shared = groups.filter((g) => !g.isPersonal);
  if (me.usualShareAskedAt !== null || shared.length !== 1) return null;
  const target = shared[0]!;
  const busy = setUsual.isPending;

  function answer(accept: boolean) {
    setUsual.mutate(accept ? target.id : null, {
      onSuccess: () => {
        if (accept) toast(`「${target.name}」をいつもの共有先にしました`);
      },
    });
  }

  return (
    <div
      role="status"
      aria-label="いつもの共有先の案内"
      className={cn(
        "glass flex min-h-10 items-center gap-1 rounded-full py-0.5 pr-0.5 pl-4 text-[12.5px] font-medium",
        className,
      )}
    >
      <span className="min-w-0 flex-1 truncate px-1.5">{`「${target.name}」をいつもの共有先にしますか`}</span>
      <Button size="sm" disabled={busy} onClick={() => answer(true)}>
        する
      </Button>
      <button
        type="button"
        className="flex size-9 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-field"
        aria-label="いつもの共有先にするかの案内を閉じる"
        disabled={busy}
        onClick={() => answer(false)}
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
