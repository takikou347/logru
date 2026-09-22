import { Camera } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { useCalendar, useMe } from "@/lib/queries";
import { poolColorsOf } from "@/modules/calendar/model";
import { DAY_MS, DEFAULT_TIME_ZONE, startOfDayIn } from "../shared/days";
import type { MemoryRecord } from "../shared/types";
import { useMemoryGroups, useMemoryList, useRecords } from "./api";
import { Dock } from "./Dock";
import { Flow } from "./Flow";
import { entriesOf, Lightbox } from "./Lightbox";
import { Ambient, GroupFilter, PhotoImg, SideGroupFilter, formatSpan } from "./parts";
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

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  const usable = new Set(group ? [group] : groups.map((g) => g.id));
  const events = (calendar.data ?? []).filter((e) => e.extension === "events" && usable.has(e.groupId));
  const memory = (list.data?.memories ?? []).find((m) => m.startsAt < to && m.endsAt > from);
  const entries = entriesOf(records.data ?? []);
  const title = valid ? new Intl.DateTimeFormat("ja-JP", { month: "long", day: "numeric", weekday: "short", timeZone: "UTC" }).format(Date.parse(date)) : "その日";

  return (
    <AppLayout
      poolColors={poolColorsOf(groups, data)}
      side={<SideGroupFilter groups={groups} me={data} value={group} onChange={(v) => setParams(v ? { group: v } : {}, { replace: true })} />}
    >
      <Ambient photo={memory?.cover ?? null} />
      <Page>
        <PageBar title={title} back="/memories" />
        <GroupFilter groups={groups} me={data} value={group} onChange={(v) => setParams(v ? { group: v } : {}, { replace: true })} />
        {memory && (
          <Link to={`/memories/${memory.id}`} className="glass grid grid-cols-[72px_1fr] items-center gap-3 rounded-3xl p-2 no-underline">
            {memory.cover ? <PhotoImg photo={memory.cover} className="size-[72px] rounded-2xl" /> : <span className="size-[72px] rounded-2xl bg-field" />}
            <span>
              <b className="block">{memory.title}</b>
              <small className="text-xs text-ink-2">{formatSpan(memory.startsAt, memory.endsAt, memory.timeZone)}・思い出を開く</small>
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
          <Button onClick={() => setRecording(true)} disabled={from > Date.now()}>
            <Camera className="size-5" />
            {from > Date.now() ? "この日になったら記録できます" : "記録する"}
          </Button>
        </Dock>
      </Page>
      {recording && <RecordSheet groups={groups} me={data} defaultGroupId={group} range={{ min: from, max: to - 1 }} onClose={() => setRecording(false)} />}
      {editing && <RecordSheet groups={groups} me={data} record={editing} range={{ min: from, max: to - 1 }} onClose={() => setEditing(null)} />}
      {photoAt !== null && photoAt >= 0 && <Lightbox entries={entries} index={photoAt} onIndex={setPhotoAt} onClose={() => setPhotoAt(null)} groups={groups} me={data} />}
    </AppLayout>
  );
}
