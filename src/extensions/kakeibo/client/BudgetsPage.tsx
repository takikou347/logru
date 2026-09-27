/**
 * 予算の画面。F-323、F-324
 * この月のカテゴリ別の合計(多い順、横の棒で割合)も出す。新しい見た目の家計簿の 1 枚の面には出ない
 * カテゴリ別の合計を、切り替えの列の「予算」の行き先であるこの画面で見られるようにする。issue #227
 */
import { PiggyBank } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { LoadableSection, PanelSkeleton } from "@/components/parts/LoadableSection";
import { Panel } from "@/components/parts/Panel";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { useRowMotion } from "@/lib/use-row-motion";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "@/modules/calendar/model";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import { kakeiboCategoryLabel } from "../shared/categories";
import { formatYen } from "../shared/format";
import type { KakeiboBudget, KakeiboCategoryTotal } from "./api";
import { useDeleteBudget, useKakeiboBudgets, useKakeiboGroups, useKakeiboSummary } from "./api";
import { BudgetRow } from "./BudgetPanel";
import { BudgetSheet } from "./BudgetSheet";
import { formatMonthLabel, monthKeyOf } from "./parts";

/**
 * 予算 1 件の行。押すと直すシートが開く。足した(元に戻した)直後は膨らんで入り、消す途中は縮んで消える。
 * 直した直後は短く光る。0044、0048、0085、#226
 */
function BudgetListRow({
  budget,
  groupLabel,
  isLeaving,
  isEdited,
  onClick,
}: {
  budget: KakeiboBudget;
  groupLabel: string;
  isLeaving: boolean;
  isEdited: boolean;
  onClick: () => void;
}) {
  const [entering] = useState(() => takeJustAdded(budget.id));
  return (
    <button
      type="button"
      className={cn("text-left", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
      data-edited={isEdited || undefined}
      onClick={onClick}
    >
      <BudgetRow budget={budget} groupLabel={groupLabel} />
    </button>
  );
}

/**
 * カテゴリ別の合計の 1 行。名前・金額と、いちばん多いカテゴリを 100% とした横の棒で割合を示す。
 * 新しい見た目の家計簿(KakeiboNewLookCard)の 1 枚の面には出さず、予算の画面にだけ足す。issue #227
 */
function CategoryTotalRow({ category, share }: { category: KakeiboCategoryTotal; share: number }) {
  const percent = Math.round(share * 100);
  return (
    <div className="flex flex-col gap-1.5 border-line py-2 not-first:border-t">
      <div className="flex items-baseline justify-between gap-2 text-[15px]">
        <span className="min-w-0 truncate" data-testid={`budgets-category-${category.category}`}>
          {kakeiboCategoryLabel(category.category)}
        </span>
        <span className="flex-none font-bold tabular-nums">{formatYen(category.total)}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-label={`${kakeiboCategoryLabel(category.category)}、${percent}%`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

/** この月のカテゴリ別の合計。多い順(summarizeExpenseByCategory がすでに並べ替え済み)。issue #227 */
function CategoryBreakdownPanel({ month, byCategory }: { month: string; byCategory: KakeiboCategoryTotal[] }) {
  if (byCategory.length === 0) return null;
  const max = Math.max(...byCategory.map((c) => c.total));
  return (
    <Panel title={`${formatMonthLabel(month)}のカテゴリ別の合計`} data-testid="budget-category-breakdown">
      <div className="flex flex-col">
        {byCategory.map((c) => (
          <CategoryTotalRow key={c.category} category={c} share={max > 0 ? c.total / max : 0} />
        ))}
      </div>
    </Panel>
  );
}

/**
 * 予算の画面。すべての予算を並べる。作る、直す、消す
 *
 * 新しい見た目の家計簿は、口座とカテゴリ別の合計を 1 枚の面には出さない(KakeiboNewLookCard の設計)。
 * カテゴリ別の合計は、切り替えの列の「予算」(円グラフのアイコン)の行き先であるこの画面に足す。issue #227
 */
export function BudgetsPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const budgets = useKakeiboBudgets(null, ready);
  const month = monthKeyOf(new Date());
  const summary = useKakeiboSummary(null, month, ready);
  const [params, setParams] = useSearchParams();
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });
  const deleteBudget = useDeleteBudget();
  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。縮んで消える動きと、直した行を光らせる印も持つ。#194、0085、#226
  const { hidden, leaving, remove, flashing, flash } = useRowMotion("予算を消しました");

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  const handleDelete = (budget: KakeiboBudget) =>
    remove(budget.id, ({ keepalive }) => deleteBudget.mutateAsync({ id: budget.id, keepalive }));
  // 同じ予算をもう一度押したときも、前のシートが閉じる動きの途中なら新しく開き直す。
  // key に積んで、確実に新しい `BudgetSheet` を作る。#211
  const editGen = useRef(0);

  if (!me.data || !ready) return <Loading />;
  const rows = (budgets.data ?? []).filter((b) => !hidden.has(b.id));
  const editing = rows.find((b) => b.id === editingId);
  const groupLabel = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    return g ? (g.isPersonal ? "自分だけ" : g.name) : "";
  };

  return (
    <>
      <Page>
        <PageBar title="予算" back="/kakeibo" />

        {/* この月のカテゴリ別の合計。新しい見た目の家計簿の 1 枚の面には出ないので、ここに足す。issue #227 */}
        <LoadableSection query={summary} what="この月の支出" skeleton={<PanelSkeleton lines={4} />}>
          {(data) => <CategoryBreakdownPanel month={month} byCategory={data.byCategory} />}
        </LoadableSection>

        {budgets.error && !budgets.data && (
          <LoadFailure what="予算" error={budgets.error} onRetry={() => void budgets.refetch()} />
        )}
        {budgets.isPending && <Loading />}

        {budgets.data && rows.length === 0 && (
          <Panel>
            <EmptyState
              pose="coin"
              bordered={false}
              action={{
                label: "予算を作る",
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              }}
            >
              まだ予算がありません。期間と金額を決めて、使いすぎを防ぎます。
            </EmptyState>
          </Panel>
        )}

        {budgets.data && rows.length > 0 && (
          <Panel>
            <div className="flex flex-col">
              {rows.map((b) => (
                <BudgetListRow
                  key={b.id}
                  budget={b}
                  groupLabel={groupLabel(b.groupId)}
                  isLeaving={leaving.has(b.id)}
                  isEdited={flashing.has(b.id)}
                  onClick={() => {
                    editGen.current += 1;
                    setParams((p) => (p.set("edit", b.id), p), { replace: true });
                  }}
                />
              ))}
            </div>
          </Panel>
        )}

        <Dock label="予算の操作">
          <PrimaryAddButton
            label="予算を作る"
            icon={PiggyBank}
            addables={[
              {
                key: "budget",
                label: "予算を作る",
                icon: PiggyBank,
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              },
            ]}
          />
        </Dock>
      </Page>
      {creating && <BudgetSheet groups={groups} me={me.data} onClose={closeCreate} />}
      {editing && (
        <BudgetSheet
          key={`${editingId}-${editGen.current}`}
          groups={groups}
          me={me.data}
          budget={editing}
          onClose={closeEdit}
          onDelete={handleDelete}
          onSaved={flash}
        />
      )}
    </>
  );
}
