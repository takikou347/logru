import { PiggyBank, Wallet } from "lucide-react";
import { HomeWidgetCard } from "@/components/parts/HomeWidgetCard";
import { formatYen } from "../shared/format";
import { useKakeiboAccounts, useKakeiboGroups, useKakeiboSummary } from "./api";
import { monthKeyOf } from "./parts";

/** 「支出を記録する」。押すと記録のシートが開く。F-305 */
export function RecordHomeWidget() {
  return (
    <HomeWidgetCard
      // from=widget は、シートを閉じたときホームへ戻すための印。#201
      to="/kakeibo?record=1&from=widget"
      testId="widget-kakeibo-record"
      icon={Wallet}
      label="支出を記録する"
      hint="金額とカテゴリ"
    />
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
  // 届いていなければ読み込み中の「…」、届かずに失敗したときは、失敗と分かる短い文にする。0078、#195
  const hint = summary.data ? formatYen(summary.data.totalExpense) : summary.error ? "読み込めません" : "…";
  return <HomeWidgetCard to="/kakeibo" testId="widget-kakeibo-total" icon={Wallet} label="今月の合計" hint={hint} />;
}

/** 「総資産」。自分の口座の残高の合計を出す。口座が無ければ口座を作る道を出す。F-316 */
export function AssetsWidget() {
  const { groups, ready } = useKakeiboGroups();
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  const accounts = useKakeiboAccounts(personalGroupId, ready && Boolean(personalGroupId));
  // data が届くまでは、口座が無いとは決まらない。読み込み中や失敗のときに「口座を作る」を出さない。0078、#195
  const loaded = accounts.data !== undefined;
  const hasAccounts = (accounts.data?.length ?? 0) > 0;
  const total = accounts.data?.reduce((n, a) => n + a.balance, 0) ?? 0;
  const hint = !loaded ? (accounts.error ? "読み込めません" : "…") : hasAccounts ? formatYen(total) : "口座を作る";
  return (
    <HomeWidgetCard
      to={loaded && !hasAccounts ? "/kakeibo/accounts" : "/kakeibo"}
      testId="widget-kakeibo-assets"
      icon={PiggyBank}
      label="総資産"
      hint={hint}
    />
  );
}
