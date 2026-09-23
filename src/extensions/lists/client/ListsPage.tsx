import { ListChecks } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { GroupFilterBand, groupFilterOptions, SideGroupFilter } from "@/components/parts/GroupFilter";
import { Panel } from "@/components/parts/Panel";
import type { Addable } from "@/components/parts/PrimaryAddButton";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { poolColorsOf } from "@/modules/calendar/model";
import { useLists, useListsGroups } from "./api";
import { CreateListSheet } from "./CreateListSheet";
import { formatShortDate } from "./parts";

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
  const filterOptions = groupFilterOptions({ groups, me: data, value: filterGroup, onChange: setGroup });
  // 足せるものはリストだけ。「+」を押すと直接シートが開く。issue #150
  const addables: Addable[] = [
    {
      key: "list",
      label: "リストを作る",
      icon: ListChecks,
      onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
    },
  ];

  return (
    <AppLayout poolColors={poolColorsOf(groups, data)} side={<SideGroupFilter options={filterOptions} />}>
      <Page>
        <PageBar title="リスト" />
        <GroupFilterBand options={filterOptions} />

        {lists.error && !lists.data && (
          <LoadFailure what="リスト" error={lists.error} onRetry={() => void lists.refetch()} />
        )}
        {lists.isPending && <Loading />}

        <Panel>
          {rows.length === 0 ? (
            <EmptyState
              pose="list"
              bordered={false}
              action={{
                label: "リストを作る",
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              }}
            >
              リストを作ると、ここに並びます。
            </EmptyState>
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

        <Dock label="リストの操作">
          <PrimaryAddButton label="リストを作る" addables={addables} />
        </Dock>
      </Page>
      {creating && <CreateListSheet groups={groups} me={data} defaultGroupId={filterGroup} onClose={closeCreate} />}
    </AppLayout>
  );
}
