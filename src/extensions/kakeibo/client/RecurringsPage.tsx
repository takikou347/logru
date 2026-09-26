/** 定期の記録の画面。F-325 */
import { Repeat } from "lucide-react";
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
import { kakeiboCategoryLabel } from "../shared/categories";
import { useKakeiboGroups, useKakeiboRecurrings } from "./api";
import { formatMonthLabel } from "./parts";
import { RecurringSheet } from "./RecurringSheet";

/** 定期の記録の画面。すべて並べる。作る、直す、止める、消す */
export function RecurringsPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const recurrings = useKakeiboRecurrings();
  const [params, setParams] = useSearchParams();
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });

  if (!me.data || !ready) return <Loading />;
  const rows = recurrings.data ?? [];
  const editing = rows.find((r) => r.id === editingId);
  const groupLabel = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    return g ? (g.isPersonal ? "自分だけ" : g.name) : "";
  };

  return (
    <>
      <Page>
        <PageBar title="定期の記録" back="/kakeibo" />

        {recurrings.error && !recurrings.data && (
          <LoadFailure what="定期の記録" error={recurrings.error} onRetry={() => void recurrings.refetch()} />
        )}
        {recurrings.isPending && <Loading />}

        {recurrings.data && rows.length === 0 && (
          <Panel>
            <EmptyState
              pose="coin"
              bordered={false}
              action={{
                label: "定期の記録を作る",
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              }}
            >
              まだ定期の記録がありません。毎月の家賃や給料などを決めておくと、自動で記録されます。
            </EmptyState>
          </Panel>
        )}

        {recurrings.data && rows.length > 0 && (
          <Panel>
            <ul className="flex flex-col">
              {rows.map((r) => (
                <li key={r.id} className="border-line not-first:border-t">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 py-2 text-left"
                    onClick={() => setParams((p) => (p.set("edit", r.id), p), { replace: true })}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="min-w-0 truncate text-[15px] font-medium">
                        {kakeiboCategoryLabel(r.category)}
                        {r.paused && "(止めている)"}
                      </span>
                      <span className="text-xs text-ink-2">
                        毎月{r.dayOfMonth}日 ・ {groupLabel(r.groupId)}
                        {r.endMonth ? ` ・ ${formatMonthLabel(r.startMonth)}〜${formatMonthLabel(r.endMonth)}` : ""}
                      </span>
                    </span>
                    <span className="flex-none font-bold tabular-nums">
                      {r.type === "income" ? "+" : ""}
                      {r.amount.toLocaleString("ja-JP")}円
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </Panel>
        )}

        <Dock label="定期の記録の操作">
          <PrimaryAddButton
            label="定期の記録を作る"
            addables={[
              {
                key: "recurring",
                label: "定期の記録を作る",
                icon: Repeat,
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              },
            ]}
          />
        </Dock>
      </Page>
      {creating && <RecurringSheet groups={groups} me={me.data} onClose={closeCreate} />}
      {editing && <RecurringSheet groups={groups} me={me.data} recurring={editing} onClose={closeEdit} />}
    </>
  );
}
