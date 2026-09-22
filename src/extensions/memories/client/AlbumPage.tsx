import { useState } from "react";
import { LoadFailure } from "@/components/Failure";
import { Empty } from "@/components/Panel";
import { cn } from "@/lib/utils";
import { dayKeyIn, memoryDays } from "../shared/days";
import { useRecords } from "./api";
import { entriesOf, Lightbox } from "./Lightbox";
import { MemoryShell, type ShellProps } from "./MemoryShell";
import { formatClock, PhotoImg } from "./parts";

/** アルバム。思い出の写真を日ごとに 3 列で並べる。押すと大きく出る。F-115 */
export function AlbumPage() {
  return <MemoryShell face="album">{(p) => <Album {...p} />}</MemoryShell>;
}

function Album({ detail, me, groups }: ShellProps) {
  const { memory } = detail;
  const records = useRecords(memory.groupId, memory.startsAt, memory.endsAt);
  const entries = entriesOf(records.data ?? []);
  const [open, setOpen] = useState<number | null>(null);
  const days = memoryDays(memory);

  if (records.error) return <LoadFailure what="写真" error={records.error} onRetry={() => void records.refetch()} />;
  if (records.data && entries.length === 0) return <Empty>写真はまだありません。「1 日」から記録すると、ここに並びます。</Empty>;
  return (
    <>
      {days.map((day) => {
        const list = entries.map((e, i) => ({ ...e, i })).filter((e) => dayKeyIn(e.record.occurredAt, memory.timeZone) === day);
        if (list.length === 0) return null;
        return (
          <section key={day} aria-label={`${day} の写真`} className="flex flex-col gap-2.5">
            <h2 className="glass flex items-baseline gap-2 rounded-full px-4.5 py-2">
              <span className="text-xl font-extrabold">{day.slice(5).replace("-", ".")}</span>
              <span className="text-xs font-bold">{new Intl.DateTimeFormat("ja-JP", { weekday: "short", timeZone: "UTC" }).format(Date.parse(day))}</span>
              <span className="ml-auto text-xs text-ink-2">{list.length} 枚</span>
            </h2>
            <ul className="grid auto-rows-[114px] grid-cols-3 gap-[3px] overflow-hidden rounded-[22px] lg:auto-rows-[180px]">
              {list.map((e, j) => (
                <li key={e.photo.id} className={cn(j % 7 === 0 && "col-span-2 row-span-2")}>
                  <button type="button" className="relative block size-full" aria-label={`${formatClock(e.record.occurredAt, memory.timeZone)} の写真を大きく見る`} onClick={() => setOpen(e.i)}>
                    <PhotoImg photo={e.photo} className="size-full" />
                    {e.record.kind === "koma" && e.record.komaSlot && (
                      <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white/88 px-2 text-[11px] leading-5 font-bold text-[#17202c]">
                        {new Intl.DateTimeFormat("ja-JP", { hour: "numeric", timeZone: memory.timeZone }).format(e.record.komaSlot)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {open !== null && (
        <Lightbox entries={entries} index={open} onIndex={setOpen} onClose={() => setOpen(null)} groups={groups} me={me} memoryId={memory.id} timeZone={memory.timeZone} />
      )}
    </>
  );
}
