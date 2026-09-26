import { ListChecks } from "lucide-react";
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
import { Panel } from "@/components/parts/Panel";
import type { Addable } from "@/components/parts/PrimaryAddButton";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { poolColorsOf } from "@/modules/calendar/model";
import type { ListSummary } from "./api";
import { useLists, useListsGroups } from "./api";
import { CreateListSheet } from "./CreateListSheet";
import { formatShortDate, GroupLabel } from "./parts";

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
  const [features, setFeatures] = useState(false);

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });
  const filterOptions = groupFilterOptions({ groups, me: me.data, value: filterGroup, onChange: setGroup });
  useAppFrame({ poolColors: poolColorsOf(groups, me.data), side: <SideGroupFilter options={filterOptions} /> });

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
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
    <>
      <Page>
        {/* 見出しを押すと機能のシートが開き、ほかの拡張の画面へ近道できる。issue #26 */}
        <PageBar title="リスト" onTitleClick={() => setFeatures(true)} />
        <GroupFilterBand options={filterOptions} />

        {/* rows が届いてから空の案内を出す。読み込み中や失敗のときに、空の案内と並んで出さない。0078、#195 */}
        <LoadableSection query={lists} what="リスト" skeleton={<PanelSkeleton lines={4} />}>
          {(rows: ListSummary[]) => (
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
                  {rows.map((l) => {
                    const group = groups.find((g) => g.id === l.groupId);
                    return (
                      <li key={l.id} className="border-line not-first:border-t">
                        <Link
                          to={`/lists/${l.id}`}
                          className="grid min-h-14 grid-cols-[1fr_auto] items-center gap-2 py-2 text-ink no-underline"
                        >
                          <span className="flex min-w-0 flex-col gap-0.5">
                            <b className="truncate text-[15px]">{l.title}</b>
                            <span className="flex items-center gap-2">
                              <GroupLabel group={group} me={data} />
                              {l.date && <time className="text-xs text-ink-2">{formatShortDate(l.date)}</time>}
                            </span>
                          </span>
                          <span className="text-sm text-ink-2">
                            {l.itemCount === 0 ? "空" : `残り ${l.remainingCount} / ${l.itemCount}`}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          )}
        </LoadableSection>

        <Dock label="リストの操作">
          <PrimaryAddButton label="リストを作る" addables={addables} />
        </Dock>
      </Page>
      {creating && <CreateListSheet groups={groups} me={data} defaultGroupId={filterGroup} onClose={closeCreate} />}
      {features && <FeatureSheet onClose={() => setFeatures(false)} />}
    </>
  );
}
