import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { poolColorsOf } from "@/modules/calendar/model";
import { useLists, useListsGroups } from "./api";
import { CreateListSheet } from "./CreateListSheet";
import { formatShortDate, GroupFilter, SideGroupFilter } from "./parts";

/**
 * リストの一覧。F-202
 * すべて、自分だけ、グループで絞る。新しい順に、名前と残りの数のカードで並ぶ。
 * `?create=1` で開くと、作るシートを出す。
 */
export function ListsPage() {
  const me = useMe();
  const { groups, ready } = useListsGroups();
  const [params, setParams] = useSearchParams();
  const groupParam = params.get("group");
  const filterGroup = groups.some((g) => g.id === groupParam) ? groupParam : null;
  const setGroup = (id: string | null) =>
    setParams((p) => (id ? p.set("group", id) : p.delete("group"), p), { replace: true });
  const lists = useLists(filterGroup, ready);

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  const rows = lists.data ?? [];

  return (
    <AppLayout
      poolColors={poolColorsOf(groups, data)}
      side={<SideGroupFilter groups={groups} me={data} value={filterGroup} onChange={setGroup} />}
    >
      <Page>
        <PageBar title="リスト" />
        <GroupFilter groups={groups} me={data} value={filterGroup} onChange={setGroup} />

        {lists.error && !lists.data && (
          <LoadFailure what="リスト" error={lists.error} onRetry={() => void lists.refetch()} />
        )}
        {lists.isPending && <Loading />}

        <Panel>
          {rows.length === 0 ? (
            <Empty>リストを作ると、ここに並びます。</Empty>
          ) : (
            <ul className="flex flex-col">
              {rows.map((l) => (
                <li key={l.id} className="border-line not-first:border-t">
                  <Link
                    to={`/lists/${l.id}`}
                    className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-2 py-2 text-ink no-underline"
                  >
                    <span className="flex min-w-0 flex-col">
                      <b className="truncate text-[15px]">{l.title}</b>
                      {l.date && <time className="text-xs text-ink-2">{formatShortDate(l.date)}</time>}
                    </span>
                    <span className="text-sm text-ink-2">
                      {l.itemCount === 0 ? "空" : `残り ${l.remainingCount} / ${l.itemCount}`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <div className="flex justify-end">
          <Button onClick={() => setParams((p) => (p.set("create", "1"), p), { replace: true })}>
            <Plus className="size-5" />
            リストを作る
          </Button>
        </div>
      </Page>
      {creating && <CreateListSheet groups={groups} me={data} defaultGroupId={filterGroup} onClose={closeCreate} />}
    </AppLayout>
  );
}
