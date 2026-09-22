import { ChevronLeft, ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import { clientExtension, defaultExtension } from "../../../extensions/registry.client";
import { useEnabledExtensions } from "@/lib/extensions";
import type { EditorTarget } from "../../../extensions/types.client";
import type { GroupSummary } from "../../../shared/api-types";
import { AccountMenu, AppLayout, SideHeading, sideItemClass } from "@/components/AppLayout";
import { LoadFailure } from "@/components/Failure";
import { Chip } from "@/components/Chip";
import { FeatureSheet } from "@/components/FeatureSheet";
import { Dot } from "@/components/Panel";
import { Segmented } from "@/components/Segmented";
import { ShortcutBand } from "@/components/ShortcutBand";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { groupColor } from "@/lib/colors";
import { addDays, addMonths, dateKey, monthGrid, onDay, parseDateKey, sameDay, startOfDay, weekDays } from "@/lib/dates";
import { useMemberVisibility } from "@/lib/mutations";
import { useCalendar, useGroups, useMe } from "@/lib/queries";
import { DayPanel, ItemList } from "./DayItems";
import { MonthGrid } from "./MonthGrid";
import { RefreshButton } from "./RefreshButton";
import { byPeople, decorate, groupPeopleOf, hiddenPeople, peopleOf, poolColorsOf, type Person, type ViewItem } from "./model";
import { PeopleChip, SideGroup, useOpenGroups } from "./PeopleFilter";
import { itemKey, useUndoableDelete } from "./use-undoable-delete";
import { WeekList } from "./WeekList";

type View = "month" | "week" | "day";
const VIEWS = [
  { value: "month", label: "月" },
  { value: "week", label: "週" },
  { value: "day", label: "日" },
] as const;

/** 今日の 0 時。画面を開いたまま日付が変わったら追いかける */
function useToday(): Date {
  const [today, setToday] = useState(() => startOfDay(new Date()));
  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = startOfDay(new Date());
      setToday((t) => (sameDay(t, now) ? t : now));
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);
  return today;
}

/**
 * カレンダーの画面。月、週、日で切り替え、グループと人で絞る。F-05〜F-09、F-20
 *
 * 表示の単位、選んだ日、グループの絞り込みは URL に持つ。出す人は自分の画面だけの設定として D1 に持つ。読み込み直しても、共有しても同じ画面になる。
 * 項目は拡張から集めたもの。押すと、その項目を出した拡張の編集のシートを開く。
 */
export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const me = useMe();
  const groups = useGroups();
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [features, setFeatures] = useState(false);
  const enabledExtensions = useEnabledExtensions();
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

  const selectedTime = selected.getTime();
  const days = useMemo(() => {
    const d = new Date(selectedTime);
    if (view === "month") return monthGrid(d);
    if (view === "week") return weekDays(d);
    return [startOfDay(d)];
  }, [view, selectedTime]);

  // 月の表では、表に出る前後の月の日も読む
  const from = days[0]!.getTime();
  const to = addDays(days[days.length - 1]!, 1).getTime();
  const calendar = useCalendar(from, to);

  const allGroups = useMemo(() => groups.data ?? [], [groups.data]);
  const sections = useMemo(() => (me.data ? groupPeopleOf(allGroups, me.data) : []), [allGroups, me.data]);
  const people = useMemo(() => (me.data ? peopleOf(allGroups, me.data) : []), [allGroups, me.data]);
  const sideOpen = useOpenGroups("logru-side-groups", false);
  const hiddenIds = useMemo(() => hiddenPeople(me.data?.hiddenMembers ?? [], people), [me.data, people]);
  const { mutate: setVisibility } = useMemberVisibility();
  const togglePerson = useCallback((p: Person, hide: boolean) => setVisibility({ userId: p.id, hidden: hide }), [setVisibility]);
  const items = useMemo<ViewItem[]>(() => {
    if (!calendar.data || !me.data) return [];
    return byPeople(decorate(calendar.data, allGroups, me.data), hiddenIds).filter(
      (i) => !hidden.has(itemKey(i)) && (!groupFilter || i.groupId === groupFilter),
    );
  }, [calendar.data, allGroups, me.data, hidden, groupFilter, hiddenIds]);

  const move = useCallback(
    (dir: -1 | 1) => {
      if (view === "month") update({ date: addMonths(selected, dir) });
      else update({ date: addDays(selected, dir * (view === "week" ? 7 : 1)) });
    },
    [view, selected, update],
  );

  const addNew = useCallback(
    (date: Date) => setEditor({ mode: "new", date, groupId: groupFilter ?? undefined }),
    [groupFilter],
  );

  // PC のキー。左右で移る、T で今日、N で予定を足す。0012
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editor || features || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key === "t" || e.key === "T") update({ date: today });
      else if (e.key === "n" || e.key === "N") addNew(selected);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, features, move, update, today, selected, addNew]);

  const focusIndex = groupFilter ? allGroups.slice(0, 3).findIndex((g) => g.id === groupFilter) : -1;
  const open = (item: ViewItem) => setEditor({ mode: "edit", item });
  const upcoming = items.filter((i) => i.startsAt >= Date.now()).slice(0, 5);
  const showTodayButton = !sameDay(selected, today) || view !== "month";
  const editorKey = editor?.mode === "edit" ? editor.item.extension : defaultExtension.manifest.key;
  const Editor = editor?.mode === "edit" ? (clientExtension(editor.item.extension)?.Editor ?? null) : defaultExtension.Editor;
  // ほかの拡張が、このシートに足す欄。使える拡張の分だけ渡す。0019
  const addons = enabledExtensions.flatMap((x) => (x.itemAddons ?? []).filter((a) => a.extension === editorKey).map((a) => a.Component));

  /** グループで絞る選択肢の中身。自分だけのグループは「自分だけの予定」と書く。0009 */
  const groupOption = (g: GroupSummary) => ({
    key: g.id,
    pressed: groupFilter === g.id,
    onClick: () => update({ group: groupFilter === g.id ? null : g.id }),
    children: (
      <>
        <Dot color={me.data ? groupColor(g, me.data.colorPrefs) : g.color} />
        {g.isPersonal ? "自分だけの予定" : g.name}
      </>
    ),
  });

  /** 絞り込みの選択肢。スマホは丸いボタン、PC は左の列の行 */
  const filters = (render: (p: { key: string; pressed: boolean; onClick: () => void; children: React.ReactNode }) => React.ReactNode) => [
    render({ key: "all", pressed: !groupFilter, onClick: () => update({ group: null }), children: "すべて" }),
    ...allGroups.map((g) => render(groupOption(g))),
  ];

  /**
   * 予定を足すボタン。
   * @param narrow 狭い幅では言葉を隠し、＋の印だけにする。下の操作の帯を折り返さずに収めるため
   */
  const addButton = (narrow = false) => (
    <Button onClick={() => addNew(selected)} aria-label="予定を足す" className={narrow ? "px-4" : undefined}>
      <Plus className="size-5" />
      <span aria-hidden="true" className={narrow ? "hidden min-[380px]:inline" : undefined}>
        予定を足す
      </span>
    </Button>
  );

  return (
    <AppLayout
      poolColors={poolColorsOf(allGroups, me.data)}
      poolFocus={focusIndex >= 0 ? focusIndex : null}
      side={
        <div role="group" aria-label="表示するグループ" className="pr-2">
          <SideHeading>表示するグループ</SideHeading>
          {filters(({ key, pressed, onClick, children }) => {
            // 共有のグループは、矢印でメンバーを開き、人ごとに出し入れできる。F-20
            const section = sections.find((s) => s.group.id === key);
            if (!section) {
              return (
                <button key={key} type="button" className={sideItemClass} aria-pressed={pressed} onClick={onClick}>
                  {children}
                </button>
              );
            }
            return (
              <SideGroup
                key={key}
                section={section}
                label={children}
                pressed={pressed}
                onFilter={onClick}
                open={sideOpen.isOpen(key)}
                onOpenChange={(o) => sideOpen.setOpen(key, o)}
                hidden={hiddenIds}
                onToggle={togglePerson}
              />
            );
          })}
        </div>
      }
    >
      {/*
        スマホの幅では、月と年に「今日」「前」「次」「読み直す」「アカウント」を足すと 1 行に入らない。
        入る月と入らない月で高さが変わると落ち着かないので、スマホではいつも月と年の下へ操作を置く。
        9 月でも 10 月でも、「今日」が出ても出なくても、帯の形は変わらない。PC は 1 行のまま
      */}
      <header className="glass flex min-h-[58px] flex-wrap items-center gap-x-2 gap-y-1 rounded-panel py-1.5 pr-1.5 pl-4 lg:flex-nowrap lg:pl-5">
        <h1 className="flex shrink-0 items-baseline gap-1" aria-live="polite">
          <span data-testid="month-number" className="text-[38px] leading-none font-bold">{selected.getMonth() + 1}</span>
          <span className="text-[17px] font-bold">月</span>
          <span className="ml-2 text-[17px] font-medium text-ink-2">{selected.getFullYear()}</span>
        </h1>
        <div className="flex w-full shrink-0 items-center justify-end gap-0.5 lg:ml-auto lg:w-auto lg:gap-1">
          {showTodayButton && (
            <button
              type="button"
              className="min-h-10 shrink-0 rounded-full border border-(--glass-edge) bg-field px-3.5 text-[13px] font-bold whitespace-nowrap"
              onClick={() => update({ date: today })}
            >
              今日
            </button>
          )}
          <Button variant="ghost" size="icon" aria-label={view === "month" ? "前の月" : "前へ"} onClick={() => move(-1)}>
            <ChevronLeft className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" aria-label={view === "month" ? "次の月" : "次へ"} onClick={() => move(1)}>
            <ChevronRight className="size-5" />
          </Button>
          <RefreshButton />
          <div className="ml-2 hidden gap-2.5 lg:flex">
            <Segmented label="表示の単位" value={view} options={VIEWS} onChange={(v) => update({ view: v })} />
            {addButton()}
          </div>
          <AccountMenu />
        </div>
      </header>

      <ShortcutBand className="lg:hidden" />

      {/* グループが多いときは横に流れる。流せることが分かるよう、下にいつもバーを出す。F-25 */}
      <nav className="-mx-4 lg:hidden" aria-label="グループで絞る">
        <ScrollArea orientation="horizontal" className="px-4" viewportClassName="pb-1.5" scrollbarClassName="left-4! right-4!">
          <div className="flex w-max gap-2">
            {filters(({ key, pressed, onClick, children }) => (
              <Chip key={key} aria-pressed={pressed} onClick={onClick}>
                {children}
              </Chip>
            ))}
            {sections.length > 0 && <PeopleChip sections={sections} total={people.length} hidden={hiddenIds} onToggle={togglePerson} />}
          </div>
        </ScrollArea>
      </nav>

      {calendar.error && (!calendar.data || calendar.isPlaceholderData) && <LoadFailure what={`${selected.getMonth() + 1} 月の予定`} error={calendar.error} onRetry={() => void calendar.refetch()} />}

      <div className={calendar.error && (!calendar.data || calendar.isPlaceholderData) ? "hidden" : "contents xl:grid xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start xl:gap-4"}>
        {view === "month" ? (
          <MonthGrid
            days={days}
            month={selected.getMonth()}
            today={today}
            selected={selected}
            items={items}
            onPressDay={(d) => {
              update({ date: d });
              addNew(d);
            }}
            onOpenItem={open}
          />
        ) : (
          <WeekList days={days} today={today} items={items} onSelect={(d) => update({ date: d, view: "day" })} onOpen={open} />
        )}
        <aside className="contents lg:grid lg:grid-cols-[repeat(auto-fit,minmax(280px,1fr))] lg:items-start lg:gap-4 xl:sticky xl:top-4 xl:flex xl:flex-col">
          {view === "month" && <DayPanel day={selected} items={items} onOpen={open} />}
          <section className="glass hidden rounded-panel px-4.5 py-4 lg:block" aria-label="このあとの予定">
            <h2 className="mb-1 text-xs font-bold text-ink-2">このあと</h2>
            <ItemList items={upcoming} onOpen={open} empty="この期間に、このあとの予定はありません。" />
          </section>
        </aside>
      </div>

      <div
        role="toolbar"
        aria-label="カレンダーの操作"
        className="glass fixed inset-x-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-20 mx-auto flex max-w-[528px] items-center justify-between gap-1 rounded-full p-1.5 lg:hidden">
        <Button variant="ghost" size="icon" aria-label="機能" onClick={() => setFeatures(true)}>
          <LayoutGrid className="size-5" />
        </Button>
        <Segmented label="表示の単位" value={view} options={VIEWS} onChange={(v) => update({ view: v })} compact />
        {addButton(true)}
      </div>

      {features && <FeatureSheet onClose={() => setFeatures(false)} />}

      {editor && Editor && me.data && (
        // 一覧から選んで直すシートに切り替えたとき、入力の中身を作り直すために key を変える
        <Editor
          key={editor.mode === "edit" ? `edit:${itemKey(editor.item)}` : "new"}
          target={editor}
          dayItemsOf={editor.mode === "new" ? (d) => items.filter((i) => !i.secondary && onDay(i, d)) : undefined}
          onOpenItem={(item) => setEditor({ mode: "edit", item })}
          groups={allGroups}
          me={me.data}
          onClose={() => setEditor(null)}
          onDelete={remove}
          addons={addons}
        />
      )}
    </AppLayout>
  );
}
