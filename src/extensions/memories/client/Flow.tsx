import type { CalendarItem, GroupSummary, Me } from "@shared/api-types";
import { Check } from "lucide-react";
import { useState } from "react";
import { groupColor } from "@/lib/colors";
import { cn } from "@/lib/utils";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import type { MemoryItem, MemoryRecord, Photo } from "../shared/types";
import { formatClock, RecordBody } from "./parts";

type Row =
  | { type: "plan"; at: number; event: CalendarItem }
  | { type: "record"; at: number; record: MemoryRecord }
  | { type: "wish"; at: number; item: MemoryItem };

/**
 * 1 日の流れ。予定、記録、済んだやりたいことを時刻の順に 1 枚のガラスに並べる。F-113、F-114、0024
 * 予定は色の線と薄い文字、記録は写真と濃い文字。
 */
export function Flow({
  events,
  records,
  leaving,
  wishes = [],
  groups,
  me,
  timeZone,
  onOpenPhoto,
  onEditRecord,
  empty,
  big,
}: {
  events: CalendarItem[];
  records: MemoryRecord[];
  /** 縮んで消える動きの途中の記録の id。0044、0048、0085、#226 */
  leaving?: Set<string>;
  wishes?: MemoryItem[];
  groups: GroupSummary[];
  me: Me;
  timeZone?: string;
  onOpenPhoto: (record: MemoryRecord, photo: Photo) => void;
  onEditRecord: (record: MemoryRecord) => void;
  empty: string;
  big?: boolean;
}) {
  const rows: Row[] = [
    ...events.map((event) => ({
      type: "plan" as const,
      at: event.allDay ? event.startsAt - 1 : event.startsAt,
      event,
    })),
    ...records.map((record) => ({ type: "record" as const, at: record.occurredAt, record })),
    ...wishes.filter((w) => w.doneAt).map((item) => ({ type: "wish" as const, at: item.doneAt!, item })),
  ].sort((a, b) => a.at - b.at);

  if (rows.length === 0)
    return <p className="glass rounded-panel px-5 py-6 text-center text-sm leading-7 text-ink-2">{empty}</p>;
  const colorOf = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    return g ? groupColor(g, me.colorPrefs) : "nezumi";
  };
  return (
    <ol className="glass flex flex-col rounded-panel px-3.5 pt-1 pb-2" aria-label="1 日の流れ">
      {rows.map((row) => (
        <FlowRow
          key={
            row.type === "plan"
              ? `plan:${row.event.id}`
              : row.type === "record"
                ? `record:${row.record.id}`
                : `wish:${row.item.id}`
          }
          row={row}
          timeZone={timeZone}
          colorOf={colorOf}
          groups={groups}
          me={me}
          big={big}
          isLeaving={row.type === "record" ? Boolean(leaving?.has(row.record.id)) : false}
          onOpenPhoto={onOpenPhoto}
          onEditRecord={onEditRecord}
        />
      ))}
    </ol>
  );
}

/**
 * 1 日の流れの 1 行。予定・記録・済んだやりたいことのどれか。記録だけ、足した直後は膨らんで入り、
 * 消す途中は縮んで消える。動かすのは transform と opacity だけ。0044、0048、0085、#226
 */
function FlowRow({
  row,
  timeZone,
  colorOf,
  groups,
  me,
  big,
  isLeaving,
  onOpenPhoto,
  onEditRecord,
}: {
  row: Row;
  timeZone?: string;
  colorOf: (groupId: string) => string;
  groups: GroupSummary[];
  me: Me;
  big?: boolean;
  isLeaving: boolean;
  onOpenPhoto: (record: MemoryRecord, photo: Photo) => void;
  onEditRecord: (record: MemoryRecord) => void;
}) {
  // 描いた瞬間に 1 度だけ読む。記録だけが対象。足した直後の再描画と、それ以外の再描画を見分けるため
  const [entering] = useState(() => row.type === "record" && takeJustAdded(row.record.id));
  return (
    <li
      className={cn(
        "grid grid-cols-[46px_1fr] items-start border-line py-1 not-first:border-t",
        entering && "item-enter",
      )}
      data-leaving={isLeaving || undefined}
    >
      <time className="pt-3 text-sm font-medium text-ink-2">
        {row.type === "plan" && row.event.allDay ? "終日" : formatClock(row.at, timeZone)}
      </time>
      {row.type === "plan" && (
        <div className={`flex min-h-[42px] items-center gap-2 text-sm text-ink-2 c-${colorOf(row.event.groupId)}`}>
          <span aria-hidden="true" className="h-[18px] w-[3px] rounded-sm bg-(--c)" />
          {row.event.title}
          <span className="ml-auto text-[11px] text-ink-3">予定</span>
        </div>
      )}
      {row.type === "wish" && (
        <div className="flex min-h-[42px] items-center gap-2 text-sm font-medium">
          <span
            className="grid size-5 place-items-center rounded-md bg-primary text-primary-foreground"
            aria-hidden="true"
          >
            <Check className="size-3" strokeWidth={3} />
          </span>
          {row.item.title}
          <span className="ml-auto text-[11px] text-ink-3">やりたいこと</span>
        </div>
      )}
      {row.type === "record" && (
        <RecordBody
          record={row.record}
          groups={groups}
          me={me}
          big={big}
          onOpenPhoto={(p) => onOpenPhoto(row.record, p)}
          onEdit={onEditRecord}
        />
      )}
    </li>
  );
}
