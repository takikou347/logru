/** 予算の画面。F-323、F-324 */
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
import { Panel } from "@/components/parts/Panel";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { useRowMotion } from "@/lib/use-row-motion";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "@/modules/calendar/model";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import type { KakeiboBudget } from "./api";
import { useDeleteBudget, useKakeiboBudgets, useKakeiboGroups } from "./api";
import { BudgetRow } from "./BudgetPanel";
import { BudgetSheet } from "./BudgetSheet";

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
 * 予算の画面。すべての予算を並べる。作る、直す、消す
 */
export function BudgetsPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const budgets = useKakeiboBudgets(null, ready);
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
