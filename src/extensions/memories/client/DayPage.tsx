import { Camera } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Chip } from "@/components/parts/Chip";
import { LoadFailure } from "@/components/parts/Failure";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/modules/calendar/api";
import { DAY_MS, memoryDays, startOfDayIn } from "../shared/days";
import type { MemoryRecord } from "../shared/types";
import { useMemoryList, useRecords } from "./api";
import { memoryOfEvent } from "../shared/links";
import { Dock } from "./Dock";
import { Flow } from "./Flow";
import { KomaStrip } from "./KomaStrip";
import { entriesOf, Lightbox } from "./Lightbox";
import { MemoryShell, type ShellProps } from "./MemoryShell";
import { RecordSheet } from "./RecordSheet";

/** 思い出の 1 日。予定、記録、済んだやりたいことを時刻の順に並べる。F-114 */
export function DayPage() {
  return <MemoryShell face="day">{(p) => <Day {...p} />}</MemoryShell>;
}

function Day({ detail, me, groups }: ShellProps) {
  const { n = "0" } = useParams();
  const navigate = useNavigate();
  const { memory, items } = detail;
  const days = memoryDays(memory);
  const index = Math.min(Math.max(Number(n) || 0, 0), days.length - 1);
  const day = days[index]!;
  const from = startOfDayIn(day, memory.timeZone);
  const to = from + DAY_MS;
  const records = useRecords(memory.groupId, from, to);
  // この思い出に入る予定だけを並べる。外した予定と、先に始まる思い出に入った予定は出さない。0020
  const groupList = useMemoryList(memory.groupId);
  const groupMemories = groupList.data?.memories.filter((m) => m.groupId === memory.groupId) ?? [memory];
  const calendar = useCalendar(from, to);
  const events = (calendar.data ?? []).filter((e) => e.extension === "events" && memoryOfEvent(e, groupMemories)?.id === memory.id);
  const wishes = items.filter((i) => i.kind === "wish");
  const doneToday = wishes.filter((w) => w.doneAt && w.doneAt >= from && w.doneAt < to);
  const [recording, setRecording] = useState(false);
  // まだ来ていない日には記録できない
  const upcoming = from > Date.now();
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [photoAt, setPhotoAt] = useState<number | null>(null);
  const entries = entriesOf(records.data ?? []);
  const weekday = (key: string) => new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "UTC" }).format(Date.parse(key));

  return (
    <>
      {days.length > 1 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="日">
          {days.map((d, i) => (
            <Chip key={d} role="tab" aria-selected={i === index} aria-pressed={i === index} onClick={() => navigate(`/memories/${memory.id}/days/${i}`, { replace: true })}>
              <span className="font-bold">{d.slice(5).replace("-", ".")}</span>
              {weekday(d)}
            </Chip>
          ))}
        </div>
      )}
      {records.error && <LoadFailure what="この日の記録" error={records.error} onRetry={() => void records.refetch()} />}
      {(memory.komaEnabled || (records.data ?? []).some((r) => r.kind === "koma")) && (
        <KomaStrip
          dayStart={from}
          timeZone={memory.timeZone}
          records={records.data ?? []}
          nowPath={Date.now() >= from && Date.now() < to ? "/memories/koma/now" : undefined}
          onOpen={(r) => (r.createdBy === me.user.id ? setEditing(r) : setPhotoAt(entries.findIndex((e) => e.record.id === r.id)))}
        />
      )}
      <Flow
        events={events}
        records={(records.data ?? []).filter((r) => r.kind !== "koma")}
        wishes={doneToday}
        groups={groups}
        me={me}
        timeZone={memory.timeZone}
        big
        empty="この日の記録はまだありません。「記録する」から写真や文章を追加できます。"
        onOpenPhoto={(_r, p) => setPhotoAt(entries.findIndex((e) => e.photo.id === p.id))}
        onEditRecord={setEditing}
      />
      <Dock label="1 日の操作">
        <Button onClick={() => setRecording(true)} disabled={upcoming}>
          <Camera className="size-5" />
          {upcoming ? "この日になったら記録できます" : "記録する"}
        </Button>
      </Dock>
      {recording && (
        <RecordSheet
          groups={groups}
          me={me}
          defaultGroupId={memory.groupId}
          wishes={wishes.filter((w) => !w.doneAt)}
          range={{ min: from, max: to - 1 }}
          onClose={() => setRecording(false)}
        />
      )}
      {editing && <RecordSheet groups={groups} me={me} record={editing} range={{ min: from, max: to - 1 }} onClose={() => setEditing(null)} />}
      {photoAt !== null && photoAt >= 0 && (
        <Lightbox entries={entries} index={photoAt} onIndex={setPhotoAt} onClose={() => setPhotoAt(null)} groups={groups} me={me} memoryId={memory.id} timeZone={memory.timeZone} />
      )}
    </>
  );
}
