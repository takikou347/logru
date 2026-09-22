import type { Me } from "@shared/api-types";
import { Camera, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { poolColorsOf } from "@/modules/calendar/model";
import { DEFAULT_TIME_ZONE, dayKeyIn } from "../shared/days";
import type { Memory, MemoryRecord } from "../shared/types";
import { useMemoryGroups, useMemoryList } from "./api";
import { Dock } from "./Dock";
import { MemorySheet } from "./MemorySheet";
import { formatClock, formatSpan, GroupFilter, GroupLabel, PhotoImg, SideGroupFilter } from "./parts";
import { RecordSheet } from "./RecordSheet";

const FILTER_KEY = "logru-memories-group";

/** 絞り込みを端末に覚える。読めない環境では覚えない */
function useRememberedGroup(): [string | null, (v: string | null) => void] {
  const [value, setValue] = useState<string | null>(() => {
    try {
      return localStorage.getItem(FILTER_KEY);
    } catch {
      return null;
    }
  });
  const set = (v: string | null) => {
    setValue(v);
    try {
      if (v) localStorage.setItem(FILTER_KEY, v);
      else localStorage.removeItem(FILTER_KEY);
    } catch {
      // 覚えられなくても、この画面の中では効く
    }
  };
  return [value, set];
}

/** 出発まで何日か。今日なら 0 */
function daysUntil(memory: Memory, now: number): number {
  const today = dayKeyIn(now, memory.timeZone);
  const first = dayKeyIn(memory.startsAt, memory.timeZone);
  return Math.max(0, Math.round((Date.parse(first) - Date.parse(today)) / 86_400_000));
}

/**
 * 思い出の一覧。これからの思い出を上に、済んだ思い出を年ごとに新しい順で、表紙のカードで並べる。F-102
 * すべて、自分だけ、グループで絞る。絞り込みは端末に覚える。
 * 下の操作で、記録する、思い出を作る。`?record=1` で開くと、記録のシートを出す。
 */
export function MemoriesPage() {
  const me = useMe();
  const { groups, ready } = useMemoryGroups();
  const [params, setParams] = useSearchParams();
  const [remembered, setGroup] = useRememberedGroup();
  const group = groups.some((g) => g.id === remembered) ? remembered : null;
  const list = useMemoryList(group);
  const [creating, setCreating] = useState(false);
  const recording = params.get("record") === "1";
  const closeRecord = () => setParams((p) => (p.delete("record"), p), { replace: true });

  const now = Date.now();
  const { upcoming, byYear } = useMemo(() => {
    const all = list.data?.memories ?? [];
    const upcoming = all.filter((m) => m.endsAt > now).sort((a, b) => a.startsAt - b.startsAt);
    const past = all.filter((m) => m.endsAt <= now);
    const byYear = new Map<number, Memory[]>();
    for (const m of past) {
      const y = new Date(m.startsAt).getFullYear();
      byYear.set(y, [...(byYear.get(y) ?? []), m]);
    }
    return { upcoming, byYear: [...byYear.entries()].sort((a, b) => b[0] - a[0]) };
  }, [list.data, now]);

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  const empty = list.data && list.data.memories.length === 0 && list.data.recent.length === 0;

  return (
    <AppLayout
      poolColors={poolColorsOf(groups, data)}
      side={<SideGroupFilter groups={groups} me={data} value={group} onChange={setGroup} />}
    >
      <Page>
        <PageBar title="思い出" />
        <GroupFilter groups={groups} me={data} value={group} onChange={setGroup} />
        {list.error && !list.data && (
          <LoadFailure what="思い出" error={list.error} onRetry={() => void list.refetch()} />
        )}
        {list.isPending && <Loading />}
        {empty && (
          <Empty>
            思い出はまだありません。
            <br />
            旅行やお出かけの前に作ると、しおりを作れます。日々のできごとは「記録する」から残せます。
          </Empty>
        )}
        {upcoming.map((m, i) => (i === 0 ? <Upcoming key={m.id} memory={m} me={data} now={now} /> : null))}
        {list.data && list.data.recent.length > 0 && <Recent records={list.data.recent} me={data} />}
        {upcoming.length > 1 && <Shelf title="これから" memories={upcoming.slice(1)} me={data} />}
        {byYear.map(([year, ms]) => (
          <Shelf key={year} year={year} title="過去の思い出" memories={ms} me={data} />
        ))}
        <Dock label="思い出の操作">
          <Button variant="secondary" onClick={() => setParams((p) => (p.set("record", "1"), p))}>
            <Camera className="size-5" />
            記録する
          </Button>
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-5" />
            思い出を作る
          </Button>
        </Dock>
      </Page>
      {creating && <MemorySheet groups={groups} me={data} defaultGroupId={group} onClose={() => setCreating(false)} />}
      {recording && <RecordSheet groups={groups} me={data} defaultGroupId={group} onClose={closeRecord} />}
    </AppLayout>
  );
}

/** これからの思い出の大きなカード。出発まで何日かを出す */
function Upcoming({ memory, me, now }: { memory: Memory; me: Me; now: number }) {
  const { groups } = useMemoryGroups();
  const group = groups.find((g) => g.id === memory.groupId);
  const days = daysUntil(memory, now);
  const during = memory.startsAt <= now;
  return (
    <Link
      to={`/memories/${memory.id}`}
      className="glass flex flex-col rounded-panel p-2 no-underline"
      aria-label={`${memory.title}、${during ? "期間中" : `出発まで ${days} 日`}`}
    >
      {memory.cover ? (
        <PhotoImg photo={memory.cover} className="h-[180px] rounded-[22px]" />
      ) : (
        <div className={`h-[120px] rounded-[22px] bg-(--c) opacity-70 c-${group?.color ?? "nezumi"}`} />
      )}
      <div className="grid grid-cols-[1fr_auto] items-end gap-x-3 px-2.5 pt-3 pb-1.5">
        <h2 className="text-xl font-extrabold">{memory.title}</h2>
        <div className="row-span-2 text-right leading-none">
          <span className="mb-1 block text-[11px] text-ink-2">{during ? "現在" : "出発まで"}</span>
          {during ? (
            <span className="text-[22px] font-extrabold">期間中</span>
          ) : (
            <>
              <span className="text-[44px] font-extrabold tracking-[-0.04em]">{days}</span>
              <span className="ml-0.5 text-xs font-bold">日</span>
            </>
          )}
        </div>
        <GroupLabel group={group} me={me}>
          ・{formatSpan(memory.startsAt, memory.endsAt, memory.timeZone)}
        </GroupLabel>
      </div>
    </Link>
  );
}

/** 最近の記録。横に流れる。押すとその日へ移る */
function Recent({ records, me }: { records: MemoryRecord[]; me: Me }) {
  const { groups } = useMemoryGroups();
  return (
    <section className="glass rounded-3xl px-3 pt-3 pb-2" aria-label="最近の記録">
      <h2 className="mb-2 flex text-xs font-bold text-ink-2">
        最近の記録<span className="ml-auto font-medium">思い出以外の日も含む</span>
      </h2>
      <ScrollArea orientation="horizontal" viewportClassName="pb-2">
        <ul className="flex w-max gap-2">
          {records.map((r) => {
            const day = dayKeyIn(r.occurredAt, DEFAULT_TIME_ZONE);
            const group = groups.find((g) => g.id === r.groupId);
            return (
              <li key={r.id} className="w-[92px]">
                <Link to={`/memories/on/${day}?group=${r.groupId}`} className="block no-underline">
                  {r.photos[0] ? (
                    <PhotoImg photo={r.photos[0]} className="size-[92px] rounded-[14px]" />
                  ) : (
                    <p className="line-clamp-4 size-[92px] rounded-[14px] bg-field p-2 text-xs leading-snug">
                      {r.body}
                    </p>
                  )}
                  <small className="mt-1 flex items-center gap-1 text-[11px] whitespace-nowrap text-ink-2">
                    <GroupLabel group={group} me={me} />
                  </small>
                  <small className="block text-[11px] text-ink-2">
                    {day.slice(5).replace("-", ".")} {formatClock(r.occurredAt)}
                  </small>
                </Link>
              </li>
            );
          })}
        </ul>
      </ScrollArea>
    </section>
  );
}

/** 思い出のカードを 2 列で並べる棚 */
function Shelf({ title, year, memories, me }: { title: string; year?: number; memories: Memory[]; me: Me }) {
  const { groups } = useMemoryGroups();
  const photos = memories.reduce((n, m) => n + m.photoCount, 0);
  return (
    <section aria-label={year ? `${year} 年の${title}` : title} className="flex flex-col gap-2.5">
      <h2 className="glass flex items-baseline gap-2 rounded-full px-4.5 py-2">
        {year && <span className="text-[22px] font-extrabold tracking-[-0.02em]">{year}</span>}
        <b className="text-[15px]">{title}</b>
        <span className="ml-auto text-xs text-ink-2">
          {memories.length} つ・写真 {photos} 枚
        </span>
      </h2>
      <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
        {memories.map((m) => {
          const group = groups.find((g) => g.id === m.groupId);
          return (
            <li key={m.id}>
              <Link to={`/memories/${m.id}`} className="glass flex flex-col rounded-[22px] p-1.5 no-underline">
                {m.cover ? (
                  <PhotoImg photo={m.cover} className="h-[108px] rounded-[17px]" />
                ) : (
                  <div className={`h-[108px] rounded-[17px] bg-(--c) opacity-60 c-${group?.color ?? "nezumi"}`} />
                )}
                <h3 className="px-1.5 pt-2 text-sm font-bold">{m.title}</h3>
                <span className="px-1.5 pb-1.5">
                  <GroupLabel group={group} me={me}>
                    ・{formatSpan(m.startsAt, m.endsAt, m.timeZone)}・{m.photoCount} 枚
                  </GroupLabel>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
