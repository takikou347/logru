import { ChevronRight, PiggyBank, Wallet } from "lucide-react";
import { Link } from "react-router";
import { formatYen } from "../shared/format";
import { useKakeiboAccounts, useKakeiboGroups, useKakeiboSummary } from "./api";
import { monthKeyOf } from "./parts";

/** 「支出を記録する」。押すと記録のシートが開く。F-305 */
export function RecordHomeWidget() {
  return (
    <Link
      // from=widget は、シートを閉じたときホームへ戻すための印。#201
      to="/kakeibo?record=1&from=widget"
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
  return enabled && summary.data ? formatYen(summary.data.totalExpense) : null;
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
        <small className="truncate text-xs text-ink-2">
          {summary.data ? formatYen(summary.data.totalExpense) : "…"}
        </small>
      </span>
      <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
    </Link>
  );
}

/** 「総資産」。自分の口座の残高の合計を出す。口座が無ければ口座を作る道を出す。F-316 */
export function AssetsWidget() {
  const { groups, ready } = useKakeiboGroups();
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  const accounts = useKakeiboAccounts(personalGroupId, ready && Boolean(personalGroupId));
  const hasAccounts = (accounts.data?.length ?? 0) > 0;
  const total = accounts.data?.reduce((n, a) => n + a.balance, 0) ?? 0;
  return (
    <Link
      to={hasAccounts ? "/kakeibo" : "/kakeibo/accounts"}
      data-testid="widget-kakeibo-assets"
      className="glass grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-panel py-2.5 pr-3 pl-2.5 text-ink no-underline"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <PiggyBank className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px]">総資産</b>
        <small className="truncate text-xs text-ink-2">{hasAccounts ? formatYen(total) : "口座を作る"}</small>
      </span>
      <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
    </Link>
  );
}
