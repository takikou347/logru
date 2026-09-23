import { ChevronRight, Wallet } from "lucide-react";
import { Link } from "react-router";
import { formatYen } from "../shared/format";
import { useKakeiboSummary } from "./api";
import { monthKeyOf } from "./parts";

/** 「支出を記録する」。押すと記録のシートが開く。F-305 */
export function RecordHomeWidget() {
  return (
    <Link
      to="/kakeibo?record=1"
      data-testid="widget-kakeibo-record"
      className="glass grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-panel py-2.5 pr-3 pl-2.5 text-ink no-underline"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Wallet className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px]">支出を記録する</b>
        <small className="truncate text-xs text-ink-2">金額とカテゴリ</small>
      </span>
      <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
    </Link>
  );
}

/** 機能のタイルに出す短い字。今月の支出の合計。使っていないときは読み込まない。0058 */
export function useMonthTotalHint(enabled: boolean): string | null {
  const month = monthKeyOf(new Date());
  const summary = useKakeiboSummary(null, month, enabled);
  return enabled && summary.data ? formatYen(summary.data.total) : null;
}

/** 「今月の合計」。使えるすべてのグループを合わせた、今月の支出の合計を出す。F-306 */
export function MonthTotalWidget() {
  const month = monthKeyOf(new Date());
  const summary = useKakeiboSummary(null, month);
  return (
    <Link
      to="/kakeibo"
      data-testid="widget-kakeibo-total"
      className="glass grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-panel py-2.5 pr-3 pl-2.5 text-ink no-underline"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Wallet className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px]">今月の合計</b>
        <small className="truncate text-xs text-ink-2">{summary.data ? formatYen(summary.data.total) : "…"}</small>
      </span>
      <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
    </Link>
  );
}
