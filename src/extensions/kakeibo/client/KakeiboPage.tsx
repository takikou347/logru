import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel, PanelRow } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { poolColorsOf } from "@/modules/calendar/model";
import { kakeiboCategoryLabel } from "../shared/categories";
import { isMonthKey } from "../shared/dates";
import { formatYen } from "../shared/format";
import { useKakeiboGroups, useKakeiboSummary } from "./api";
import { ExpenseSheet } from "./ExpenseSheet";
import { addMonthsToKey, formatMonthLabel, GroupFilter, monthKeyOf, SideGroupFilter } from "./parts";

/**
 * 家計簿の画面。F-303
 *
 * すべて、自分だけ、グループで絞る。月を選んで、その月の合計とカテゴリ別の合計、記録の一覧を見る。
 * `?record=1` で開くと記録のシート、`?edit=<id>` で開くと直すシートを出す。
 * `?month=` と `?group=` は、カレンダーの日ごとの合計から移ったときにも使う。
 */
export function KakeiboPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const [params, setParams] = useSearchParams();

  const groupParam = params.get("group");
  const group = groups.some((g) => g.id === groupParam) ? groupParam : null;
  const monthParam = params.get("month");
  const month = monthParam && isMonthKey(monthParam) ? monthParam : monthKeyOf(new Date());
  const summary = useKakeiboSummary(group, month, ready);

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
  const records = summary.data?.records ?? [];

  return (
    <AppLayout
      poolColors={poolColorsOf(groups, data)}
      side={<SideGroupFilter groups={groups} me={data} value={group} onChange={setGroup} />}
    >
      <Page>
        <PageBar title="家計簿" />
        <GroupFilter groups={groups} me={data} value={group} onChange={setGroup} />

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
              {formatYen(summary.data.total)}
            </p>
            <div className="flex flex-col">
              {summary.data.byCategory.map((c) => (
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
            <Empty>この月の記録はまだありません。</Empty>
          ) : (
            <ul className="flex flex-col">
              {records.map((r) => (
                <li key={r.id} className="border-line not-first:border-t">
                  <button
                    type="button"
                    className="grid w-full grid-cols-[52px_1fr_auto] items-center gap-2 py-2 text-left"
                    onClick={() => setParams((p) => (p.set("edit", r.id), p), { replace: true })}
                  >
                    <time className="text-xs text-ink-2">{r.date.slice(5).replace("-", ".")}</time>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm font-medium">{kakeiboCategoryLabel(r.category)}</span>
                      {r.memo && <span className="truncate text-xs text-ink-2">{r.memo}</span>}
                    </span>
                    <span className="font-bold">{formatYen(r.amount)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex justify-end">
          <Button onClick={() => setParams((p) => (p.set("record", "1"), p), { replace: true })}>
            <Plus className="size-5" />
            記録する
          </Button>
        </div>
      </Page>
      {recording && <ExpenseSheet groups={groups} me={data} defaultGroupId={group} onClose={closeRecord} />}
      {editing && <ExpenseSheet groups={groups} me={data} expense={editing} onClose={closeEdit} />}
    </AppLayout>
  );
}
