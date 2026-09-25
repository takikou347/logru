import { Camera } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { Dock } from "@/components/parts/Dock";
import { GroupFilterBand, groupFilterOptions, SideGroupFilter } from "@/components/parts/GroupFilter";
import type { Addable } from "@/components/parts/PrimaryAddButton";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { formatDay, parseDateKey } from "@/lib/dates";
import { useCalendar } from "@/modules/calendar/api";
import { poolColorsOf } from "@/modules/calendar/model";
import { DAY_MS, DEFAULT_TIME_ZONE, startOfDayIn } from "../shared/days";
import type { MemoryRecord } from "../shared/types";
import { useMemoryGroups, useMemoryList, useRecords } from "./api";
import { Flow } from "./Flow";
import { entriesOf, Lightbox } from "./Lightbox";
import { Ambient, formatSpan, PhotoImg } from "./parts";
import { RecordSheet } from "./RecordSheet";

/**
 * その日。思い出の外の日も含め、その日の予定と記録を時刻の順に並べる。F-113
 * その日を含む思い出があれば、上に表紙を出す。押すとその思い出の 1 日へ移る。
 */
export function OnDayPage() {
  const { date = "" } = useParams();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const { groups, ready } = useMemoryGroups();
  const group = groups.some((g) => g.id === params.get("group")) ? params.get("group") : null;
  const ids = group ? group : groups.map((g) => g.id).join(",");
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  const from = valid ? startOfDayIn(date, DEFAULT_TIME_ZONE) : 0;
  const to = from + DAY_MS;
  const records = useRecords(ids, from, to, valid);
  const calendar = useCalendar(from, to);
  const list = useMemoryList(group);
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [photoAt, setPhotoAt] = useState<number | null>(null);
  const filterOptions = groupFilterOptions({
    groups,
    me: me.data,
    value: group,
    onChange: (v) => setParams(v ? { group: v } : {}, { replace: true }),
  });
  useAppFrame({ poolColors: poolColorsOf(groups, me.data), side: <SideGroupFilter options={filterOptions} /> });

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  const usable = new Set(group ? [group] : groups.map((g) => g.id));
  const events = (calendar.data ?? []).filter((e) => e.extension === "events" && usable.has(e.groupId));
  const memory = (list.data?.memories ?? []).find((m) => m.startsAt < to && m.endsAt > from);
  const entries = entriesOf(records.data ?? []);
  // 日付の書き方は決定 0059。parseDateKey は端末の時間帯で Date を作るので、UTC のずれを気にせず使える
  const parsedDate = valid ? parseDateKey(date) : null;
  const title = parsedDate ? formatDay(parsedDate) : "その日";
  const upcoming = from > Date.now();
  // 足せるものは記録だけ。「+」を押すと直接シートが開く。0062、0067
  const addables: Addable[] = [
    { key: "record", label: "写真を記録する", icon: Camera, onClick: () => setRecording(true) },
  ];

  return (
    <>
      <Ambient photo={memory?.cover ?? null} />
      <Page>
        <PageBar title={title} back="/memories" />
        <GroupFilterBand options={filterOptions} />
        {memory && (
          <Link
            to={`/memories/${memory.id}`}
            className="glass grid grid-cols-[72px_1fr] items-center gap-3 rounded-3xl p-2 no-underline"
          >
            {memory.cover ? (
              <PhotoImg photo={memory.cover} className="size-[72px] rounded-2xl" />
            ) : (
              <span className="size-[72px] rounded-2xl bg-field" />
            )}
            <span>
              <b className="block">{memory.title}</b>
              <small className="text-xs text-ink-2">
                {formatSpan(memory.startsAt, memory.endsAt, memory.timeZone)}・思い出を開く
              </small>
            </span>
          </Link>
        )}
        <Flow
          events={events}
          records={records.data ?? []}
          groups={groups}
          me={data}
          empty="この日の記録はありません。"
          onOpenPhoto={(_r, p) => setPhotoAt(entries.findIndex((e) => e.photo.id === p.id))}
          onEditRecord={setEditing}
        />
        <Dock label="その日の操作">
          <PrimaryAddButton
            label="写真を記録する"
            addables={addables}
            disabled={upcoming}
            disabledLabel="この日になったら記録できます"
          />
        </Dock>
      </Page>
      {recording && (
        <RecordSheet
          groups={groups}
          me={data}
          defaultGroupId={group}
          range={{ min: from, max: to - 1 }}
          onClose={() => setRecording(false)}
        />
      )}
      {editing && (
        <RecordSheet
          groups={groups}
          me={data}
          record={editing}
          range={{ min: from, max: to - 1 }}
          onClose={() => setEditing(null)}
        />
      )}
      {photoAt !== null && photoAt >= 0 && (
        <Lightbox
          entries={entries}
          index={photoAt}
          onIndex={setPhotoAt}
          onClose={() => setPhotoAt(null)}
          groups={groups}
          me={data}
        />
      )}
    </>
  );
}
