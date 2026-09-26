import type { GroupMember, Me } from "@shared/api-types";
import { ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { FeatureSheet } from "@/components/parts/FeatureSheet";
import { GroupFilterBand, groupFilterOptions, SideGroupFilter } from "@/components/parts/GroupFilter";
import { LoadableSection, PanelSkeleton } from "@/components/parts/LoadableSection";
import { Empty, Panel, PanelRow } from "@/components/parts/Panel";
import type { Addable } from "@/components/parts/PrimaryAddButton";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { Button } from "@/components/ui/button";
import { dateKey, formatShortDate } from "@/lib/dates";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { poolColorsOf } from "@/modules/calendar/model";
import { upcomingOrCurrentBudgets } from "../shared/budgets";
import { kakeiboCategoryLabel } from "../shared/categories";
import { isMonthKey } from "../shared/dates";
import { formatSignedYen, formatYen } from "../shared/format";
import { sumByType, summarizeExpenseByCategory } from "../shared/totals";
import type { KakeiboExpense, KakeiboSummary } from "./api";
import { useDeleteExpense, useKakeiboAccounts, useKakeiboBudgets, useKakeiboGroups, useKakeiboSummary } from "./api";
import { BudgetRow } from "./BudgetPanel";
import { ExpenseSheet } from "./ExpenseSheet";
import { accountRefLabel, addMonthsToKey, formatMonthLabel, kakeiboPersonName, monthKeyOf } from "./parts";
import { SettlementPanel } from "./SettlementPanel";

/**
 * 記録の行。振替は「出す元 → 入れる先」、収入は金額の前に「+」。
 * 立て替えは、払った人と自分の負担額を添える。design.md「記録」の並び
 */
function RecordRow({
  record,
  groupLabel,
  members,
  me,
  onClick,
}: {
  record: KakeiboExpense;
  groupLabel: string;
  members: GroupMember[];
  me: Me;
  onClick: () => void;
}) {
  const relation =
    record.type === "transfer"
      ? `${accountRefLabel(record.account) ?? "口座なし"} → ${accountRefLabel(record.toAccount) ?? "口座なし"}`
      : kakeiboCategoryLabel(record.category);
  const account = record.type !== "transfer" ? accountRefLabel(record.account) : null;
  const amount = record.type === "income" ? formatSignedYen(record.amount) : formatYen(record.amount);
  const mySplit = record.splits?.find((s) => s.userId === me.user.id);
  return (
    <li className="border-line not-first:border-t">
      <button
        type="button"
        className="grid min-h-11 w-full grid-cols-[4.75rem_1fr] items-center gap-1 py-1 text-left"
        onClick={onClick}
      >
        <time className="text-sm font-medium whitespace-nowrap text-ink-2">{formatShortDate(record.date)}</time>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span className="min-w-0 truncate text-sm font-medium">{relation}</span>
            {account && <span className="min-w-0 truncate text-xs text-ink-2">{account}</span>}
          </span>
          <span className="flex min-w-0 items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
              {record.memo && <span className="min-w-0 truncate">{record.memo}</span>}
              <span className="flex-none">{groupLabel}</span>
            </span>
            <span className="flex-none font-bold text-ink tabular-nums">{amount}</span>
          </span>
          {record.splitMode && (
            <span className="text-xs text-ink-2">
              {kakeiboPersonName(record.paidBy, members, me)}が払った
              {mySplit && ` ・ 自分の負担 ${formatYen(mySplit.amount)}`}
            </span>
          )}
        </span>
      </button>
    </li>
  );
}

/**
 * 家計簿の画面。F-303
 *
 * すべて、自分だけ、グループで絞る。月を選んで、その月の合計とカテゴリ別の合計、口座の残高、記録の一覧を見る。
 * `?record=1` で開くと記録のシート、`?edit=<id>` で開くと直すシートを出す。
 * `?month=` と `?group=` は、カレンダーの日ごとの合計から移ったときにも使う。
 */
export function KakeiboPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const [params, setParams] = useSearchParams();
  const deleteExpense = useDeleteExpense();
  const { pending, remove: removeRecord } = useUndoableDelete("記録を消しました");
  const [features, setFeatures] = useState(false);

  const groupParam = params.get("group");
  const group = groups.some((g) => g.id === groupParam) ? groupParam : null;
  const monthParam = params.get("month");
  const month = monthParam && isMonthKey(monthParam) ? monthParam : monthKeyOf(new Date());
  const summary = useKakeiboSummary(group, month, ready);
  const accounts = useKakeiboAccounts(group, ready);
  const budgets = useKakeiboBudgets(group, ready);

  const setGroup = (id: string | null) =>
    setParams((p) => (id ? p.set("group", id) : p.delete("group"), p), { replace: true });
  const setMonth = (key: string) => setParams((p) => (p.set("month", key), p), { replace: true });

  const recording = params.get("record") === "1";
  const closeRecord = () => setParams((p) => (p.delete("record"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  const editing = summary.data?.records.find((r) => r.id === editingId);
  const filterOptions = groupFilterOptions({ groups, me: me.data, value: group, onChange: setGroup });
  useAppFrame({ poolColors: poolColorsOf(groups, me.data), side: <SideGroupFilter options={filterOptions} /> });

  if (!me.data || !ready) return <Loading />;
  const meData = me.data;
  const selectedGroup = groups.find((g) => g.id === group);
  // 今日を含む予算と、これからの予算だけを出す。終わった予算は出さない。F-324
  const today = dateKey(new Date());
  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。issue #12
  const handleDeleteExpense = (expense: KakeiboExpense) =>
    removeRecord(expense.id, ({ keepalive }) => deleteExpense.mutateAsync({ id: expense.id, keepalive }));
  const openRecordSheet = () => setParams((p) => (p.set("record", "1"), p), { replace: true });
  // 足せるものは記録だけ。「+」を押すと直接シートが開く。issue #150
  const addables: Addable[] = [{ key: "expense", label: "支出を記録する", icon: Coins, onClick: openRecordSheet }];

  /** 「この月の合計」から「記録」までの、summary から作る面。data が届いてから呼ぶ。0078、#195 */
  function summaryPanels(data: KakeiboSummary) {
    const records = data.records.filter((r) => !pending.has(r.id));
    const totalExpense = sumByType(records, "expense");
    const totalIncome = sumByType(records, "income");
    const byCategory = summarizeExpenseByCategory(records);
    // 「すべて」で絞ったときだけ、精算が残っているグループを 1 行ずつ出す。押すとそのグループで絞る。#197
    const allSettlements = data.settlements ?? [];

    return (
      <>
        <Panel title="この月の合計">
          <p className="text-3xl font-extrabold" data-testid="kakeibo-total">
            {formatYen(totalExpense)}
          </p>
          <div className="flex flex-col">
            <PanelRow>
              <span>収入</span>
              <span className="font-bold" data-testid="kakeibo-income">
                {formatSignedYen(totalIncome)}
              </span>
            </PanelRow>
            <PanelRow>
              <span>差し引き</span>
              <span className="font-bold" data-testid="kakeibo-net">
                {formatSignedYen(totalIncome - totalExpense)}
              </span>
            </PanelRow>
            {data.toShared !== null && (
              <PanelRow>
                <span>共有口座へ入れた額</span>
                <span className="font-bold" data-testid="kakeibo-to-shared">
                  {formatYen(data.toShared)}
                </span>
              </PanelRow>
            )}
            {data.fromShared !== null && (
              <PanelRow>
                <span>共有口座から受け取った額</span>
                <span className="font-bold" data-testid="kakeibo-from-shared">
                  {formatSignedYen(data.fromShared)}
                </span>
              </PanelRow>
            )}
            {data.sharedBurden !== null && data.sharedBurden > 0 && (
              <PanelRow>
                <span>グループで負担した額</span>
                <span className="font-bold" data-testid="kakeibo-shared-burden">
                  {formatYen(data.sharedBurden)}
                </span>
              </PanelRow>
            )}
            {data.debts?.map((d) => {
              const g = groups.find((x) => x.id === d.groupId);
              const net = d.receivable - d.payable;
              return (
                <Link
                  key={d.groupId}
                  to={`/kakeibo?group=${d.groupId}`}
                  className="flex min-h-11 items-center justify-between gap-3 border-b border-line text-sm text-ink no-underline last:border-b-0"
                >
                  <span className="min-w-0 truncate">{g ? `${g.name}の立て替え` : "立て替え"}</span>
                  <span className="flex-none font-bold tabular-nums" data-testid={`kakeibo-debt-${d.groupId}`}>
                    {net > 0 ? `受け取る ${formatYen(net)}` : `払う ${formatYen(-net)}`}
                  </span>
                </Link>
              );
            })}
          </div>
        </Panel>

        {selectedGroup && !selectedGroup.isPersonal && (
          <SettlementPanel groups={groups} group={selectedGroup} me={meData} />
        )}

        {!group && allSettlements.length > 0 && (
          <Panel title="精算">
            <ul className="flex flex-col">
              {allSettlements.flatMap((gs) => {
                const g = groups.find((x) => x.id === gs.groupId);
                return gs.transfers.map((t, i) => (
                  <li key={`${gs.groupId}-${i}`} className="border-line not-first:border-t">
                    <Link
                      to={`/kakeibo?group=${gs.groupId}`}
                      className="flex min-h-11 items-center justify-between gap-2 py-1 text-sm text-ink no-underline"
                    >
                      <span className="min-w-0 truncate">
                        {g?.name ?? ""} {kakeiboPersonName(t.from, g?.members ?? [], meData)} →{" "}
                        {kakeiboPersonName(t.to, g?.members ?? [], meData)}
                      </span>
                      <b className="flex-none font-bold tabular-nums">{formatYen(t.amount)}</b>
                    </Link>
                  </li>
                ));
              })}
            </ul>
            {/* あとから入った人は、それまでの割り勘に入っていない。0072 の困ること */}
            <p className="text-xs text-ink-2">あとから入った人は、それまでの記録では割られていません。</p>
          </Panel>
        )}

        {byCategory.length > 0 && (
          <Panel title="カテゴリ">
            <div className="flex flex-col">
              {byCategory.map((c) => (
                <PanelRow key={c.category}>
                  <span data-testid={`kakeibo-category-${c.category}`}>{kakeiboCategoryLabel(c.category)}</span>
                  <span className="font-bold">{formatYen(c.total)}</span>
                </PanelRow>
              ))}
            </div>
          </Panel>
        )}

        <Panel title="記録">
          {records.length === 0 ? (
            <EmptyState pose="coin" bordered={false} action={{ label: "支出を記録する", onClick: openRecordSheet }}>
              この月の記録はまだありません。
            </EmptyState>
          ) : (
            <ul className="flex flex-col">
              {records.map((r) => {
                const recordGroup = groups.find((g) => g.id === r.groupId);
                const groupLabel = recordGroup ? (recordGroup.isPersonal ? "自分だけ" : recordGroup.name) : "";
                return (
                  <RecordRow
                    key={r.id}
                    record={r}
                    groupLabel={groupLabel}
                    members={recordGroup?.members ?? []}
                    me={meData}
                    onClick={() => setParams((p) => (p.set("edit", r.id), p), { replace: true })}
                  />
                );
              })}
            </ul>
          )}
        </Panel>
      </>
    );
  }

  return (
    <>
      <Page>
        {/* 見出しを押すと機能のシートが開き、ほかの拡張の画面へ近道できる。issue #26 */}
        <PageBar title="家計簿" onTitleClick={() => setFeatures(true)} />
        <GroupFilterBand options={filterOptions} />

        <div className="glass flex items-center justify-between rounded-full px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="前の月"
            onClick={() => setMonth(addMonthsToKey(month, -1))}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <span className="text-[15px] font-bold">{formatMonthLabel(month)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="次の月"
            onClick={() => setMonth(addMonthsToKey(month, 1))}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        {/* 予算の道は、いつでも定期の記録・よく使う記録の帯にも出す。#196 */}
        <LoadableSection query={budgets} what="予算" skeleton={<PanelSkeleton lines={3} />}>
          {(budgetRows) => {
            const shownBudgets = upcomingOrCurrentBudgets(budgetRows, today);
            return (
              <Panel title="予算">
                {shownBudgets.length > 0 ? (
                  <div className="flex flex-col">
                    {shownBudgets.map((b) => (
                      <BudgetRow key={b.id} budget={b} />
                    ))}
                  </div>
                ) : budgetRows.length === 0 ? (
                  <EmptyState pose="coin" bordered={false} action={{ label: "予算を作る", to: "/kakeibo/budgets" }}>
                    まだ予算がありません。期間と金額を決めて、使いすぎを防ぎます。
                  </EmptyState>
                ) : (
                  <Empty>今の予算はありません。</Empty>
                )}
              </Panel>
            );
          }}
        </LoadableSection>

        <LoadableSection query={summary} what="家計簿" skeleton={<PanelSkeleton lines={5} />}>
          {summaryPanels}
        </LoadableSection>

        <LoadableSection query={accounts} what="口座" skeleton={<PanelSkeleton lines={3} />}>
          {(accountsList) => {
            // グループごとに分けて並べる。自分の口座は総資産、共有口座はそのグループの合計を見出しにする。issue #177
            const groupedAccounts = groups
              .map((g) => ({ group: g, accounts: accountsList.filter((a) => a.groupId === g.id) }))
              .filter((g) => g.accounts.length > 0);
            return (
              <Panel title="口座">
                {accountsList.length === 0 ? (
                  <EmptyState pose="coin" bordered={false} action={{ label: "口座を作る", to: "/kakeibo/accounts" }}>
                    まだ口座がありません。作ると、残高と総資産が分かります。
                  </EmptyState>
                ) : (
                  <>
                    <div className="flex flex-col gap-3">
                      {groupedAccounts.map(({ group: g, accounts: groupAccounts }) => {
                        const total = groupAccounts.reduce((n, a) => n + a.balance, 0);
                        return (
                          <div key={g.id} className="flex flex-col">
                            <div className="flex items-center justify-between gap-3">
                              <span className="min-w-0 truncate text-sm text-ink-2">
                                {g.isPersonal ? "総資産" : `${g.name}の共有口座`}
                              </span>
                              <span
                                className="text-xl font-extrabold tabular-nums"
                                data-testid={g.isPersonal ? "kakeibo-assets" : undefined}
                              >
                                {formatYen(total)}
                              </span>
                            </div>
                            <div className="flex flex-col">
                              {groupAccounts.map((a) => (
                                <PanelRow key={a.id}>
                                  <Link
                                    to={`/kakeibo/accounts/${a.id}`}
                                    className="min-w-0 flex-1 truncate text-ink no-underline"
                                  >
                                    {a.name}
                                  </Link>
                                  <span className="font-bold tabular-nums">{formatYen(a.balance)}</span>
                                </PanelRow>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <Link to="/kakeibo/accounts" className="text-xs text-ink-2 underline underline-offset-2">
                      口座の画面へ
                    </Link>
                  </>
                )}
              </Panel>
            );
          }}
        </LoadableSection>

        <Panel>
          <div className="flex items-center gap-4 text-xs text-ink-2 underline underline-offset-2">
            <Link to="/kakeibo/budgets">予算</Link>
            <Link to="/kakeibo/recurrings">定期の記録</Link>
            <Link to="/kakeibo/templates">よく使う記録</Link>
          </div>
        </Panel>

        {/* 空の月は中身が短く、浮いた「+」が中身に重なるので、下の帯と同じ高さの余白を足す。issue #24 */}
        <div className="h-[var(--dock-clearance)] lg:hidden" aria-hidden="true" />

        <Dock label="家計簿の操作">
          <PrimaryAddButton label="支出を記録する" addables={addables} />
        </Dock>
      </Page>
      {recording && <ExpenseSheet groups={groups} me={meData} defaultGroupId={group} onClose={closeRecord} />}
      {editing && (
        <ExpenseSheet
          groups={groups}
          me={meData}
          expense={editing}
          onClose={closeEdit}
          onDelete={handleDeleteExpense}
        />
      )}
      {features && <FeatureSheet onClose={() => setFeatures(false)} />}
    </>
  );
}
