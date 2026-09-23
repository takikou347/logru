import { ChevronRight, ListChecks } from "lucide-react";
import { Link } from "react-router";
import { useLists } from "./api";

/** 機能のタイルに出す短い字。いちばん新しいリストの残りの数。使っていないときは読み込まない。0058 */
export function useLatestListHint(enabled: boolean): string | null {
  const lists = useLists(null, enabled);
  const latest = (lists.data ?? [])[0];
  return enabled && latest ? `残り ${latest.remainingCount}` : null;
}

/**
 * 「リスト」。いちばん新しいリストの名前と、残りの項目の数を出す。押すとそのリストへ移る。F-209
 * リストが無ければ、作るよう促し、押すと一覧へ移る。
 */
export function LatestListWidget() {
  const lists = useLists(null);
  const latest = (lists.data ?? [])[0];
  return (
    <Link
      to={latest ? `/lists/${latest.id}` : "/lists"}
      data-testid="widget-lists-latest"
      className="glass grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-panel py-2.5 pr-3 pl-2.5 text-ink no-underline"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <ListChecks className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px]">{latest ? latest.title : "リスト"}</b>
        <small className="truncate text-xs text-ink-2">
          {!lists.data ? "…" : latest ? `残り ${latest.remainingCount}` : "作ってみましょう"}
        </small>
      </span>
      <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
    </Link>
  );
}
