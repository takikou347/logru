import "../styles/app.css";
import "../styles/calendar.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { DayPanel, ItemList } from "../calendar/DayItems";
import { EventSheet, type SheetTarget } from "../calendar/EventSheet";
import { MonthGrid } from "../calendar/MonthGrid";
import { decorate, poolColorsOf, type ViewItem } from "../calendar/model";
import { useUndoableDelete } from "../calendar/useUndoableDelete";
import { WeekList } from "../calendar/WeekList";
import { groupColor } from "../lib/colors";
import { addDays, addMonths, dateKey, monthGrid, parseDateKey, sameDay, startOfDay, weekDays } from "../lib/dates";
import { useCalendar, useGroups, useMe } from "../lib/queries";
import { AppLayout, MenuButton } from "../ui/AppLayout";
import { Segmented } from "../ui/controls";

type View = "month" | "week" | "day";
const VIEWS = [
  { value: "month", label: "月" },
  { value: "week", label: "週" },
  { value: "day", label: "日" },
] as const;

function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    // 日付が変わったら追いかける
    const timer = window.setInterval(() => {
      const now = startOfDay(new Date());
      setToday((t) => (sameDay(t, now) ? t : now));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}

export function Calendar() {
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const me = useMe();
  const groups = useGroups();
  const [sheet, setSheet] = useState<SheetTarget | null>(null);
  const { hidden, remove } = useUndoableDelete();

  const view = (["month", "week", "day"].includes(params.get("view") ?? "") ? params.get("view") : "month") as View;
  const selected = parseDateKey(params.get("date") ?? "") ?? today;
  const groupFilter = params.get("group");

  const update = useCallback(
    (next: { view?: View; date?: Date; group?: string | null }) => {
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          if (next.view) q.set("view", next.view);
          if (next.date) q.set("date", dateKey(next.date));
          if (next.group !== undefined) {
            if (next.group) q.set("group", next.group);
            else q.delete("group");
          }
          return q;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const days = useMemo(() => {
    if (view === "month") return monthGrid(selected);
    if (view === "week") return weekDays(selected);
    return [startOfDay(selected)];
  }, [view, selected.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps

  // 月の表では、右の欄のために前後の週も読む
  const from = days[0]!.getTime();
  const to = addDays(days[days.length - 1]!, 1).getTime();
  const calendar = useCalendar(from, to);

  const allGroups = groups.data ?? [];
  const items = useMemo<ViewItem[]>(() => {
    if (!calendar.data || !me.data) return [];
    return decorate(calendar.data, allGroups, me.data).filter(
      (i) => !hidden.has(i.id) && (!groupFilter || i.groupId === groupFilter),
    );
  }, [calendar.data, allGroups, me.data, hidden, groupFilter]);

  const move = useCallback(
    (dir: -1 | 1) => {
      if (view === "month") update({ date: addMonths(selected, dir) });
      else update({ date: addDays(selected, dir * (view === "week" ? 7 : 1)) });
    },
    [view, selected, update],
  );

  // PC のキー。左右で移る、T で今日、N で予定を足す。0012
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (sheet || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "t" || e.key === "T") update({ date: today });
      else if (e.key === "n" || e.key === "N") setSheet({ mode: "new", date: selected, groupId: groupFilter ?? undefined });
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet, move, update, today, selected, groupFilter]);

  const poolColors = poolColorsOf(allGroups, me.data);
  const focusIndex = groupFilter ? allGroups.slice(0, 3).findIndex((g) => g.id === groupFilter) : -1;

  const open = (item: ViewItem) => setSheet({ mode: "edit", item });
  const upcoming = items.filter((i) => i.startsAt >= Date.now()).slice(0, 5);
  const showTodayButton = !sameDay(selected, today) || view !== "month";

  const filterButtons = (className: string) => [
    <button key="all" type="button" className={className} aria-pressed={!groupFilter} onClick={() => update({ group: null })}>
      すべて
    </button>,
    ...allGroups.map((g) => (
      <button
        key={g.id}
        type="button"
        className={className}
        aria-pressed={groupFilter === g.id}
        onClick={() => update({ group: groupFilter === g.id ? null : g.id })}
      >
        <span className={`dot c-${me.data ? groupColor(g, me.data.colorPrefs) : g.color}`} aria-hidden="true" />
        {g.isPersonal ? "自分" : g.name}
      </button>
    )),
  ];

  return (
    <AppLayout
      poolColors={poolColors}
      poolFocus={focusIndex >= 0 ? focusIndex : null}
      side={
        <div role="group" aria-label="表示するグループ">
          <h2>表示するグループ</h2>
          {filterButtons("navitem")}
        </div>
      }
    >
      <header className="topbar glass">
        <h1 className="month" aria-live="polite">
          <span className="n">{selected.getMonth() + 1}</span>
          <span className="jp">月</span>
          <span className="yr">{selected.getFullYear()}</span>
        </h1>
        <div className="tools">
          {showTodayButton && (
            <button type="button" className="today-btn" onClick={() => update({ date: today, view: view })}>
              今日
            </button>
          )}
          <button type="button" className="icon-btn" aria-label={view === "month" ? "前の月" : "前へ"} onClick={() => move(-1)}>
            ‹
          </button>
          <button type="button" className="icon-btn" aria-label={view === "month" ? "次の月" : "次へ"} onClick={() => move(1)}>
            ›
          </button>
          <div className="desktop-only" style={{ display: "flex", gap: 10, marginLeft: 8 }}>
            <Segmented label="表示の単位" value={view} options={VIEWS} onChange={(v) => update({ view: v })} />
            <button type="button" className="btn primary" onClick={() => setSheet({ mode: "new", date: selected, groupId: groupFilter ?? undefined })}>
              <span className="plus">＋</span>予定を足す
            </button>
          </div>
          <MenuButton />
        </div>
      </header>

      <nav className="filters" aria-label="グループで絞る">
        {filterButtons("chip")}
      </nav>

      {calendar.error && (
        <p className="notice error" role="alert">
          {calendar.error.message}
        </p>
      )}

      <div className="cal-desktop">
        {view === "month" ? (
          <MonthGrid
            days={days}
            month={selected.getMonth()}
            today={today}
            selected={selected}
            items={items}
            onSelect={(d) => update({ date: d })}
            onLongPress={(d) => {
              update({ date: d });
              setSheet({ mode: "new", date: d, groupId: groupFilter ?? undefined });
            }}
            onOpenItem={open}
          />
        ) : (
          <WeekList days={days} today={today} items={items} onSelect={(d) => update({ date: d, view: "day" })} onOpen={open} />
        )}
        <aside className="rightcol">
          {view === "month" && <DayPanel day={selected} items={items} onOpen={open} />}
          <section className="upnext glass" aria-label="このあとの予定">
            <h2>このあと</h2>
            <ItemList items={upcoming} onOpen={open} empty="この期間に、このあとの予定はありません。" />
          </section>
        </aside>
      </div>

      <div className="dock glass">
        <Segmented label="表示の単位" value={view} options={VIEWS} onChange={(v) => update({ view: v })} />
        <button type="button" className="btn primary" onClick={() => setSheet({ mode: "new", date: selected, groupId: groupFilter ?? undefined })}>
          <span className="plus">＋</span>予定を足す
        </button>
      </div>

      {sheet && me.data && (
        <EventSheet target={sheet} groups={allGroups} me={me.data} onClose={() => setSheet(null)} onDelete={remove} />
      )}
    </AppLayout>
  );
}
