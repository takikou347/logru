import { Dot, FieldMessage, PanelRow } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { DAY_MS, formatDay, formatTime, sameDay } from "@/lib/dates";
import type { ItemEditorProps } from "../../types.client";

/**
 * 項目の日時を、読むための文にする。
 * 終日は日付だけ、時刻のあるものは日付と時刻。日をまたげば終わりの日付も出す。
 */
function describeWhen(startsAt: number, endsAt: number | null, allDay: boolean): string {
  const start = new Date(startsAt);
  if (allDay) {
    const last = endsAt ? new Date(endsAt - DAY_MS) : start;
    return sameDay(start, last) ? `${formatDay(start)} 終日` : `${formatDay(start)} から ${formatDay(last)} まで 終日`;
  }
  if (endsAt == null) return `${formatDay(start)} ${formatTime(startsAt)}`;
  const end = new Date(endsAt);
  return sameDay(start, end)
    ? `${formatDay(start)} ${formatTime(startsAt)} から ${formatTime(endsAt)}`
    : `${formatDay(start)} ${formatTime(startsAt)} から ${formatDay(end)} ${formatTime(endsAt)}`;
}

/**
 * 取り込んだ予定を見るシート。読むだけで、直すボタンも消すボタンも出さない。
 * 直すのは元のカレンダーで行う。
 */
export function ExternalEventSheet({ target, onClose }: ItemEditorProps) {
  if (target.mode !== "edit") return null;
  const item = target.item;
  return (
    <ResponsiveSheet title={item.title} description="外部のカレンダーから取り込んだ予定です。" onClose={onClose}>
      <div>
        <PanelRow>
          <span className="text-ink-2">日時</span>
          <span className="text-right">{describeWhen(item.startsAt, item.endsAt, item.allDay)}</span>
        </PanelRow>
        {item.place && (
          <PanelRow>
            <span className="text-ink-2">場所</span>
            <span className="min-w-0 text-right break-words">{item.place}</span>
          </PanelRow>
        )}
        <PanelRow>
          <span className="text-ink-2">カレンダー</span>
          <span className="flex min-w-0 items-center gap-2">
            {item.color && <Dot color={item.color} />}
            <span className="truncate">{item.sourceName}</span>
          </span>
        </PanelRow>
      </div>
      <FieldMessage>直すときは、Google カレンダーで直してください。30 分ほどで、ここにも出ます。</FieldMessage>
      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          閉じる
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
