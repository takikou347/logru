/** 予算の画面。F-323、F-324 */
import { PiggyBank } from "lucide-react";
import { useRef } from "react";
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
import { poolColorsOf } from "@/modules/calendar/model";
import { useKakeiboBudgets, useKakeiboGroups } from "./api";
import { BudgetRow } from "./BudgetPanel";
import { BudgetSheet } from "./BudgetSheet";

/**
 * 予算の画面。すべての予算を並べる。作る、直す、消す
 */
export function BudgetsPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const budgets = useKakeiboBudgets(null, ready);
  const [params, setParams] = useSearchParams();
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  // 同じ予算をもう一度押したときも、前のシートが閉じる動きの途中なら新しく開き直す。
  // key に積んで、確実に新しい `BudgetSheet` を作る。#211
  const editGen = useRef(0);

  if (!me.data || !ready) return <Loading />;
  const rows = budgets.data ?? [];
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
                <button
                  key={b.id}
                  type="button"
                  className="text-left"
                  onClick={() => {
                    editGen.current += 1;
                    setParams((p) => (p.set("edit", b.id), p), { replace: true });
                  }}
                >
                  <BudgetRow budget={b} groupLabel={groupLabel(b.groupId)} />
                </button>
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
        />
      )}
    </>
  );
}
