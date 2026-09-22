import { Camera } from "lucide-react";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Chip } from "@/components/Chip";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/lib/queries";
import { DAY_MS, memoryDays, startOfDayIn } from "../shared/days";
import type { MemoryRecord } from "../shared/types";
import { useRecords } from "./api";
import { Dock } from "./Dock";
import { Flow } from "./Flow";
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
  const calendar = useCalendar(from, to);
  const events = (calendar.data ?? []).filter((e) => e.groupId === memory.groupId && e.extension === "events");
  const wishes = items.filter((i) => i.kind === "wish");
  const doneToday = wishes.filter((w) => w.doneAt && w.doneAt >= from && w.doneAt < to);
  const [recording, setRecording] = useState(false);
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
      <Flow
        events={events}
        records={records.data ?? []}
        wishes={doneToday}
        groups={groups}
        me={me}
        timeZone={memory.timeZone}
        big
        empty="この日の記録はまだありません。「記録する」で、写真と一言を残せます。"
        onOpenPhoto={(_r, p) => setPhotoAt(entries.findIndex((e) => e.photo.id === p.id))}
        onEditRecord={setEditing}
      />
      <Dock label="1 日の操作">
        <Button onClick={() => setRecording(true)}>
          <Camera className="size-5" />
          記録する
        </Button>
      </Dock>
      {recording && (
        <RecordSheet groups={groups} me={me} defaultGroupId={memory.groupId} wishes={wishes.filter((w) => !w.doneAt)} onClose={() => setRecording(false)} />
      )}
      {editing && <RecordSheet groups={groups} me={me} record={editing} onClose={() => setEditing(null)} />}
      {photoAt !== null && photoAt >= 0 && (
        <Lightbox entries={entries} index={photoAt} onIndex={setPhotoAt} onClose={() => setPhotoAt(null)} groups={groups} me={me} memoryId={memory.id} timeZone={memory.timeZone} />
      )}
    </>
  );
}
