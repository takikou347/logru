import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Notice } from "@/components/AuthShell";
import { Chip } from "@/components/Chip";
import { Field } from "@/components/Field";
import { Dot, FieldMessage, PanelRow } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { groupColor } from "@/lib/colors";
import { DAY_MS, addDays, dateKey, formatTime, holidayName, parseDateKey, startOfDay, toTimeInput, withTime } from "@/lib/dates";
import { api } from "@/lib/api";
import type { CalendarItem } from "../../../shared/api-types";
import type { DayItem, ItemEditorProps } from "../../types.client";

/**
 * 新しい予定の始まりの時刻。今日なら次の正時、ほかの日なら 9 時。
 * @param date 予定を足す日
 */
function defaultStart(date: Date): number {
  const now = new Date();
  if (startOfDay(date).getTime() === startOfDay(now).getTime()) {
    return withTime(date, `${String(Math.min(now.getHours() + 1, 23)).padStart(2, "0")}:00`);
  }
  return withTime(date, "09:00");
}

/**
 * 新しい予定のシートの上に出す、その日に既にある予定。押すと、その予定を直すシートに切り替わる。0012
 * @param day 予定を足す日。見出しに使う
 */
function DayItemList({ day, items, onOpen }: { day: Date; items: DayItem[]; onOpen: (item: CalendarItem) => void }) {
  const heading = `${day.getMonth() + 1}月${day.getDate()}日の予定`;
  return (
    <section aria-label={heading} className="-mt-1 rounded-2xl bg-field px-3.5 py-2">
      <h3 className="pt-0.5 text-xs font-bold text-ink-2">{heading}</h3>
      <ul className="flex min-w-0 flex-col">
        {items.map((i) => (
          <li key={`${i.extension}:${i.id}`} className="border-line not-first:border-t">
            <button type="button" className="grid min-h-10 w-full grid-cols-[42px_1fr] items-center gap-1 py-0.5 text-left" onClick={() => onOpen(i)}>
              <time className="text-[13px] font-medium text-ink-2">{i.allDay ? "終日" : formatTime(i.startsAt)}</time>
              <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
                <Dot color={i.color} />
                <span className="truncate">{i.title}</span>
                <span className="ml-auto flex-none pl-1.5 text-[11px] font-normal text-ink-2">{i.groupName}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * 予定を足す、直すシート。F-05〜F-07
 *
 * 終日なら始まりの日と終わりの日、そうでなければ日付と時刻を聞く。
 * 終わりの時刻が始まりより前なら、日をまたいだとみなす。
 * 新しく足すときは、その日に既にある予定をフォームの上に並べる。
 * 共有は「共有しない」が既定。グループで絞っていたら、そのグループを選んで開く。
 */
export function EventSheet({ target, dayItems, onOpenItem, groups, me, onClose, onDelete }: ItemEditorProps) {
  const qc = useQueryClient();
  const editing = target.mode === "edit" ? target.item : null;
  const personal = groups.find((g) => g.isPersonal);
  // 「共有しない」は自分だけのグループに置く。0009
  const choices = personal ? [personal, ...groups.filter((g) => g !== personal)] : groups;

  const initialStart = editing ? editing.startsAt : defaultStart(target.mode === "new" ? target.date : new Date());
  const initialEnd = editing ? editing.endsAt : initialStart + 60 * 60 * 1000;

  const [title, setTitle] = useState(editing?.title ?? "");
  const [allDay, setAllDay] = useState(editing?.allDay ?? false);
  const [startDate, setStartDate] = useState(dateKey(new Date(initialStart)));
  const [endDate, setEndDate] = useState(() => {
    if (editing?.allDay && editing.endsAt) return dateKey(new Date(editing.endsAt - DAY_MS));
    return dateKey(new Date(initialStart));
  });
  const [startTime, setStartTime] = useState(toTimeInput(initialStart));
  const [endTime, setEndTime] = useState(initialEnd ? toTimeInput(initialEnd) : "");
  // 選んだグループ。選んでいなければ空で、自分だけのグループを使う。
  // グループの一覧は、シートを開いた後に届くことがある。開いた時点の値で決め打ちしない
  const [pickedGroupId, setGroupId] = useState(
    editing?.groupId ?? (target.mode === "new" ? target.groupId : undefined) ?? "",
  );
  const groupId = pickedGroupId || personal?.id || groups[0]?.id || "";
  const chosen = groups.find((g) => g.id === groupId);
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = parseDateKey(startDate);
  const hol = start ? holidayName(start) : null;

  /**
   * 入れた日付と時刻を、送る形にする。
   * @throws 日付が無いときと、終わりの日が始まりより前のとき
   */
  function times(): { startsAt: number; endsAt: number | null } {
    const s = parseDateKey(startDate);
    if (!s) throw new Error("日付を入れてください。");
    if (allDay) {
      const e = parseDateKey(endDate) ?? s;
      if (e < s) throw new Error("終わりの日は始まりの日より後にしてください。");
      return { startsAt: s.getTime(), endsAt: addDays(e, 1).getTime() };
    }
    const startsAt = withTime(s, startTime || "09:00");
    let endsAt: number | null = endTime ? withTime(s, endTime) : null;
    if (endsAt != null && endsAt < startsAt) endsAt += DAY_MS;
    return { startsAt, endsAt };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let when: { startsAt: number; endsAt: number | null };
    try {
      when = times();
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const payload = { title: title.trim(), allDay, memo: memo.trim() || null, groupId, ...when };
    setBusy(true);
    try {
      if (editing) await api(`/events/${editing.id}`, { method: "PATCH", body: payload });
      else await api("/events", { method: "POST", body: payload });
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      toast(editing ? "予定を保存しました" : "予定を足しました");
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet title={editing ? "予定を直す" : "新しい予定"} onClose={onClose}>
      {target.mode === "new" && dayItems && dayItems.length > 0 && onOpenItem && (
        <DayItemList day={target.date} items={dayItems} onOpen={onOpenItem} />
      )}
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="題名">
          {(p) => <Input {...p} value={title} maxLength={100} placeholder="例: 歯医者" onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <PanelRow>
          <span>終日</span>
          <Switch checked={allDay} onCheckedChange={setAllDay} aria-label="終日" />
        </PanelRow>
        <div className="flex gap-2.5 *:min-w-0 *:flex-1">
          <Field label={allDay ? "始まりの日" : "日付"} hint={hol ?? undefined}>
            {(p) => (
              <Input
                {...p}
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (endDate < e.target.value) setEndDate(e.target.value);
                }}
              />
            )}
          </Field>
          {allDay && (
            <Field label="終わりの日">
              {(p) => <Input {...p} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />}
            </Field>
          )}
        </div>
        {!allDay && (
          <div className="flex gap-2.5 *:min-w-0 *:flex-1">
            <Field label="始まり">
              {(p) => <Input {...p} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
            </Field>
            <Field label="終わり">
              {(p) => <Input {...p} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
            </Field>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="event-group-label">
            共有
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="event-group-label" aria-describedby="event-group-hint">
            {choices.map((g) => (
              <Chip key={g.id} role="radio" aria-checked={g.id === groupId} onClick={() => setGroupId(g.id)}>
                <Dot color={groupColor(g, me.colorPrefs)} />
                {g.isPersonal ? "共有しない" : g.name}
              </Chip>
            ))}
          </div>
          <FieldMessage id="event-group-hint">
            {chosen && !chosen.isPersonal ? `「${chosen.name}」のメンバー全員に見えます。` : "自分だけに見えます。"}
          </FieldMessage>
        </div>
        <Field label="メモ">
          {(p) => <Textarea {...p} value={memo} maxLength={1000} placeholder="お店の名前や持ち物" onChange={(e) => setMemo(e.target.value)} />}
        </Field>
        {error && <Notice error>{error}</Notice>}
        <div className="flex justify-between gap-2">
          {editing ? (
            <Button
              type="button"
              variant="danger"
              onClick={() => {
                onDelete(editing);
                onClose();
              }}
            >
              予定を消す
            </Button>
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              やめる
            </Button>
          )}
          <Button type="submit" disabled={busy || !title.trim() || !groupId}>
            {busy ? "保存しています" : "保存する"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
