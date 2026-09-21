import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import type { CalendarItem, GroupSummary, Me } from "../../shared/api-types";
import { api } from "../lib/api";
import { groupColor } from "../lib/colors";
import { DAY_MS, addDays, dateKey, holidayName, parseDateKey, startOfDay, toTimeInput, withTime } from "../lib/dates";
import { Field, Toggle } from "../ui/controls";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

export type SheetTarget = { mode: "new"; date: Date; groupId?: string } | { mode: "edit"; item: CalendarItem };

function defaultStart(date: Date): number {
  const now = new Date();
  if (startOfDay(date).getTime() === startOfDay(now).getTime()) {
    return withTime(date, `${String(Math.min(now.getHours() + 1, 23)).padStart(2, "0")}:00`);
  }
  return withTime(date, "09:00");
}

export function EventSheet({
  target,
  groups,
  me,
  onClose,
  onDelete,
}: {
  target: SheetTarget;
  groups: GroupSummary[];
  me: Me;
  onClose: () => void;
  onDelete: (item: CalendarItem) => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const editing = target.mode === "edit" ? target.item : null;
  const personal = groups.find((g) => g.isPersonal);

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
  const [groupId, setGroupId] = useState(
    editing?.groupId ?? (target.mode === "new" ? target.groupId : undefined) ?? personal?.id ?? groups[0]?.id ?? "",
  );
  const [memo, setMemo] = useState(editing?.memo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = parseDateKey(startDate);
  const hol = start ? holidayName(start) : null;

  function body() {
    const s = parseDateKey(startDate);
    if (!s) throw new Error("日付を入れてください。");
    if (allDay) {
      const e = parseDateKey(endDate) ?? s;
      if (e < s) throw new Error("終わりの日は始まりの日より後にしてください。");
      return { startsAt: s.getTime(), endsAt: addDays(e, 1).getTime() };
    }
    const startsAt = withTime(s, startTime || "09:00");
    let endsAt: number | null = endTime ? withTime(s, endTime) : null;
    // 終わりが始まりより前なら、日をまたいだとみなす
    if (endsAt != null && endsAt < startsAt) endsAt += DAY_MS;
    return { startsAt, endsAt };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    let times: { startsAt: number; endsAt: number | null };
    try {
      times = body();
    } catch (err) {
      setError((err as Error).message);
      return;
    }
    const payload = { title: title.trim(), allDay, memo: memo.trim() || null, groupId, ...times };
    setBusy(true);
    try {
      if (editing) await api(`/events/${editing.id}`, { method: "PATCH", body: payload });
      else await api("/events", { method: "POST", body: payload });
      await qc.invalidateQueries({ queryKey: ["calendar"] });
      toast({ message: editing ? "予定を保存しました" : "予定を足しました" });
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Sheet title={editing ? "予定を直す" : "新しい予定"} onClose={onClose}>
      <form className="stack" onSubmit={submit} noValidate>
        <Field label="題名">
          {(p) => (
            <input
              {...p}
              className="input"
              value={title}
              maxLength={100}
              placeholder="例: 歯医者"
              onChange={(e) => setTitle(e.target.value)}
            />
          )}
        </Field>
        <div className="line">
          <span style={{ fontSize: 14 }}>終日</span>
          <Toggle checked={allDay} onChange={setAllDay} label="終日" />
        </div>
        <div className="when-row">
          <Field label={allDay ? "始まりの日" : "日付"} hint={hol ?? undefined}>
            {(p) => (
              <input
                {...p}
                className="input"
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
              {(p) => (
                <input {...p} className="input" type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
              )}
            </Field>
          )}
        </div>
        {!allDay && (
          <div className="when-row">
            <Field label="始まり">
              {(p) => <input {...p} className="input" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />}
            </Field>
            <Field label="終わり">
              {(p) => <input {...p} className="input" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />}
            </Field>
          </div>
        )}
        <div className="field">
          <span className="label" id="group-label">
            だれの予定か
          </span>
          <div className="wrap" role="radiogroup" aria-labelledby="group-label">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={g.id === groupId}
                className="chip"
                onClick={() => setGroupId(g.id)}
              >
                <span className={`dot c-${groupColor(g, me.colorPrefs)}`} aria-hidden="true" />
                {g.isPersonal ? "自分" : g.name}
              </button>
            ))}
          </div>
        </div>
        <Field label="メモ">
          {(p) => (
            <textarea
              {...p}
              className="input"
              value={memo}
              maxLength={1000}
              placeholder="お店の名前や持ち物"
              onChange={(e) => setMemo(e.target.value)}
            />
          )}
        </Field>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          {editing ? (
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                onDelete(editing);
                onClose();
              }}
            >
              予定を消す
            </button>
          ) : (
            <button type="button" className="btn ghost" onClick={onClose}>
              やめる
            </button>
          )}
          <button type="submit" className="btn primary" disabled={busy || !title.trim()}>
            {busy ? "保存しています" : "保存する"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
