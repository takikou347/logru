import type { GroupMember, Me } from "@shared/api-types";
import { ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { FeatureSheet } from "@/components/parts/FeatureSheet";
import { GroupFilterBand, groupFilterOptions, SideGroupFilter } from "@/components/parts/GroupFilter";
import { Panel, PanelRow } from "@/components/parts/Panel";
import type { Addable } from "@/components/parts/PrimaryAddButton";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { Button } from "@/components/ui/button";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { poolColorsOf } from "@/modules/calendar/model";
import { kakeiboCategoryLabel } from "../shared/categories";
import { isMonthKey } from "../shared/dates";
import { formatKakeiboDate, formatSignedYen, formatYen } from "../shared/format";
import { sumByType, summarizeExpenseByCategory } from "../shared/totals";
import type { KakeiboExpense } from "./api";
import { useDeleteExpense, useKakeiboAccounts, useKakeiboGroups, useKakeiboSummary } from "./api";
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
        <time className="text-sm font-medium whitespace-nowrap text-ink-2">{formatKakeiboDate(record.date)}</time>
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

  const setGroup = (id: string | null) =>
    setParams((p) => (id ? p.set("group", id) : p.delete("group"), p), { replace: true });
  const setMonth = (key: string) => setParams((p) => (p.set("month", key), p), { replace: true });

  const recording = params.get("record") === "1";
  const closeRecord = () => setParams((p) => (p.delete("record"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  const editing = summary.data?.records.find((r) => r.id === editingId);

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  // 消す途中(元に戻せる 5 秒の間)の記録は、合計からもすぐ外して見せる。実際に消す API は後から呼ばれる。issue #12
  const records = (summary.data?.records ?? []).filter((r) => !pending.has(r.id));
  const totalExpense = sumByType(records, "expense");
  const totalIncome = sumByType(records, "income");
  const byCategory = summarizeExpenseByCategory(records);
  const filterOptions = groupFilterOptions({ groups, me: data, value: group, onChange: setGroup });
  const selectedGroup = groups.find((g) => g.id === group);
  const accountsList = accounts.data ?? [];
  // グループごとに分けて並べる。自分の口座は総資産、共有口座はそのグループの合計を見出しにする。issue #177
  const groupedAccounts = groups
    .map((g) => ({ group: g, accounts: accountsList.filter((a) => a.groupId === g.id) }))
    .filter((g) => g.accounts.length > 0);
  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。issue #12
  const handleDeleteExpense = (expense: KakeiboExpense) =>
    removeRecord(expense.id, ({ keepalive }) => deleteExpense.mutateAsync({ id: expense.id, keepalive }));
  // 足せるものは記録だけ。「+」を押すと直接シートが開く。issue #150
  const addables: Addable[] = [
    {
      key: "expense",
      label: "支出を記録する",
      icon: Coins,
      onClick: () => setParams((p) => (p.set("record", "1"), p), { replace: true }),
    },
  ];

  return (
    <AppLayout poolColors={poolColorsOf(groups, data)} side={<SideGroupFilter options={filterOptions} />}>
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

        {summary.error && !summary.data && (
          <LoadFailure what="家計簿" error={summary.error} onRetry={() => void summary.refetch()} />
        )}
        {summary.isPending && <Loading />}

        {summary.data && (
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
              {summary.data.toShared !== null && (
                <PanelRow>
                  <span>共有口座へ入れた額</span>
                  <span className="font-bold" data-testid="kakeibo-to-shared">
                    {formatYen(summary.data.toShared)}
                  </span>
                </PanelRow>
              )}
              {summary.data.fromShared !== null && (
                <PanelRow>
                  <span>共有口座から受け取った額</span>
                  <span className="font-bold" data-testid="kakeibo-from-shared">
                    {formatSignedYen(summary.data.fromShared)}
                  </span>
                </PanelRow>
              )}
              {summary.data.sharedBurden !== null && summary.data.sharedBurden > 0 && (
                <PanelRow>
                  <span>グループで負担した額</span>
                  <span className="font-bold" data-testid="kakeibo-shared-burden">
                    {formatYen(summary.data.sharedBurden)}
                  </span>
                </PanelRow>
              )}
              {summary.data.debts?.map((d) => {
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
        )}

        {summary.data && selectedGroup && !selectedGroup.isPersonal && (
          <SettlementPanel groups={groups} group={selectedGroup} me={data} />
        )}

        {summary.data && byCategory.length > 0 && (
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

        <Panel title="記録">
          {records.length === 0 ? (
            <EmptyState
              pose="coin"
              bordered={false}
              action={{
                label: "支出を記録する",
                onClick: () => setParams((p) => (p.set("record", "1"), p), { replace: true }),
              }}
            >
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
                    me={data}
                    onClick={() => setParams((p) => (p.set("edit", r.id), p), { replace: true })}
                  />
                );
              })}
            </ul>
          )}
        </Panel>

        {/* 空の月は中身が短く、浮いた「+」が中身に重なるので、下の帯と同じ高さの余白を足す。issue #24 */}
        <div className="h-[var(--dock-clearance)] lg:hidden" aria-hidden="true" />

        <Dock label="家計簿の操作">
          <PrimaryAddButton label="支出を記録する" addables={addables} />
        </Dock>
      </Page>
      {recording && <ExpenseSheet groups={groups} me={data} defaultGroupId={group} onClose={closeRecord} />}
      {editing && (
        <ExpenseSheet groups={groups} me={data} expense={editing} onClose={closeEdit} onDelete={handleDeleteExpense} />
      )}
      {features && <FeatureSheet onClose={() => setFeatures(false)} />}
    </AppLayout>
  );
}
