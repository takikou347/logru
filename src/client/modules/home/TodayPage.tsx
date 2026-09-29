/**
 * 今日のページ。ラボの「新しい見た目」を入れたスマホの、下のタブ「今日のページ」の行き先。0092、F-45
 *
 * 見出し(日付、曜日、機能が出す短い 1 行)と、機能ごとの節を 1 枚のページに並べる。節は足した機能の
 * 分だけ並び、7 個以上ならよく使う上位だけ開いて残りは畳んだ機能の札にする。左右のスワイプ(見出しや
 * 余白、週の帯)で日を送る。テーマ(紙・リキッドガラス)で日めくりの見た目が違う。DayFlipDeck が担う。
 *
 * カレンダー(月・週・日)は別の画面(CalendarPage)のまま残す。この画面は URL に view を持たない
 * (`/`)ときだけ描く。view を持てば(`/?view=month` など)CalendarPage が描く。0091 の「困ること」で
 * 残っていた「今日タブとカレンダータブが同じ画面を指す」を、この issue で解く。
 */
import { clientExtension, defaultExtension } from "@extensions/client/registry";
import type { ClientExtension, EditorTarget } from "@extensions/client/types";
import type { CalendarItem } from "@shared/api-types";
import { CalendarDays } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useGroups, useMe, useSetTodayPagePrefs } from "@/api/common";
import { AccountMenu } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { InstallBanner } from "@/components/parts/InstallBanner";
import { NotificationBell } from "@/components/parts/NotificationBell";
import { ScreenTour } from "@/components/parts/ScreenTour";
import { UsualShareOfferBanner } from "@/components/parts/UsualShareBanner";
import { useTopBarViewTransitionStyle } from "@/lib/bars-view-transition";
import {
  addDays,
  dateKey,
  formatDay,
  holidayName,
  onDay,
  parseDateKey,
  sameDay,
  startOfDay,
  WEEKDAYS,
} from "@/lib/dates";
import { useHeadlineText, useTodaySections, useTodaySummaries } from "@/lib/extensions";
import { RowExpandContext, rowExpandState, useRowExpandActive, useRowExpandTransition } from "@/lib/row-expand";
import { computeOpenSectionKeys, DEFAULT_TODAY_PAGE_PREFS, orderTodaySectionKeys } from "@/lib/today-sections";
import { BASE_TOURS } from "@/lib/tours";
import { useRecordScreen } from "@/lib/use-back";
import { useMediaQuery } from "@/lib/use-media-query";
import { useCalendar } from "../calendar/api";
import { SearchButton } from "../calendar/components/SearchButton";
import { WeekBand } from "../calendar/components/WeekBand";
import { hiddenPeople, itemKey, peopleOf, poolColorsOf, type ViewItem, viewItemsOf } from "../calendar/model";
import { useCalendarDelete } from "../calendar/use-calendar-delete";
import { REOPEN_PARAM } from "../onboarding/model";
import { Onboarding } from "../onboarding/Onboarding";
import { DayFlipDeck } from "./components/DayFlipDeck";
import { FoldedFeatureGrid } from "./components/FoldedFeatureGrid";
import { TodaySectionCard } from "./components/TodaySectionCard";

/** 今日の 0 時。画面を開いたまま日付が変わったら追いかける。CalendarPage の useToday と同じ考え */
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

/** 見出しの日付・曜日・機能の 1 行。0092、issue #240 */
function DayHeading({ date, headline }: { date: Date; headline: string | null }) {
  const hol = holidayName(date);
  return (
    <div className="px-1 py-1" data-tour="today-swipe">
      <div className="flex items-baseline gap-2">
        <span data-testid="today-day-number" className="text-[44px] leading-none font-bold tracking-[-0.02em]">
          {date.getDate()}
        </span>
        <span className="text-base font-bold text-ink-2">{WEEKDAYS[date.getDay()]}曜</span>
      </div>
      <div className="mt-0.5 text-xs text-ink-2">
        {formatDay(date, { year: true })}
        {hol && <span className="ml-1.5">{hol}</span>}
      </div>
      {headline && <p className="mt-1.5 text-[13px] font-medium text-ink">{headline}</p>}
    </div>
  );
}

/**
 * ある 1 日ぶんのページの中身(週の帯、見出し、節、畳んだ機能)。DayFlipDeck が、いまの日と
 * 隣の日(スワイプの途中)の 2 通りをこの部品で描く。見出しの 1 行や畳んだ要約は、この日ぶんの
 * 拡張の hook をここで直に呼ぶ(コンポーネントの実体が日ごとに分かれるので、hook の順は崩れない)。
 */
function TodayDayContent({
  date,
  today,
  weekItems,
  itemsForDay,
  leaving,
  eventsSection,
  foldableSections,
  headlineExtension,
  openKeys,
  toggleOpen,
  onSelectWeekDay,
  onOpenItem,
}: {
  date: Date;
  today: Date;
  weekItems: ViewItem[];
  itemsForDay: ViewItem[];
  leaving: Set<string>;
  eventsSection: ClientExtension | undefined;
  /** 予定を除いた、節を持つ拡張。並べ方(0092)で並べ替えたあとの順 */
  foldableSections: ClientExtension[];
  headlineExtension: string | null;
  openKeys: Set<string>;
  toggleOpen: (key: string) => void;
  onSelectWeekDay: (d: Date) => void;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const isToday = sameDay(date, today);
  const isFuture = startOfDay(date).getTime() > today.getTime();
  const headline = useHeadlineText(headlineExtension, date, itemsForDay);
  const openSections = foldableSections.filter((x) => openKeys.has(x.manifest.key));
  const collapsedSections = foldableSections.filter((x) => !openKeys.has(x.manifest.key));
  const summaries = useTodaySummaries(collapsedSections, date, itemsForDay);

  return (
    <div className="flex flex-col gap-3">
      <WeekBand selected={date} today={today} items={weekItems} onSelect={onSelectWeekDay} />
      <DayHeading date={date} headline={headline} />
      {eventsSection && (
        <TodaySectionCard
          ext={eventsSection}
          date={date}
          isToday={isToday}
          isFuture={isFuture}
          items={itemsForDay.filter((i) => i.extension === eventsSection.manifest.key)}
          leaving={leaving}
          foldable={false}
          open={true}
          onToggleOpen={() => {}}
          onOpenItem={onOpenItem}
        />
      )}
      {openSections.map((ext) => (
        <TodaySectionCard
          key={ext.manifest.key}
          ext={ext}
          date={date}
          isToday={isToday}
          isFuture={isFuture}
          items={itemsForDay.filter((i) => i.extension === ext.manifest.key)}
          leaving={leaving}
          open={true}
          onToggleOpen={() => toggleOpen(ext.manifest.key)}
          onOpenItem={onOpenItem}
        />
      ))}
      {collapsedSections.length > 0 && (
        <FoldedFeatureGrid sections={collapsedSections} summaries={summaries} onOpen={toggleOpen} />
      )}
    </div>
  );
}

export function TodayPage() {
  useRecordScreen();
  const [params, setParams] = useSearchParams();
  const today = useToday();
  const me = useMe();
  const groups = useGroups();
  const allGroups = groups.data ?? [];
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const { hidden, leaving, remove } = useCalendarDelete();
  // 行がそのままシートに広がる動き(共有要素)。ラボの「新しい見た目」のスマホだけで使う。0044、0093、issue #241
  const rowExpandActive = useRowExpandActive();
  const { transitioningKey, openRow, resetRowExpand } = useRowExpandTransition(rowExpandActive);

  const date = parseDateKey(params.get("date") ?? "") ?? today;
  const update = useCallback(
    (d: Date) => {
      setParams(
        (p) => {
          const q = new URLSearchParams(p);
          q.set("date", dateKey(d));
          return q;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  // 3 日ぶん(前日・当日・翌日)まとめて読む。スワイプで隣の日へ動くとき、追加の問い合わせを待たずに描ける
  const from = startOfDay(addDays(date, -1)).getTime();
  const to = addDays(date, 2).getTime();
  const calendar = useCalendar(from, to);

  const people = useMemo(() => (me.data ? peopleOf(allGroups, me.data) : []), [allGroups, me.data]);
  const hiddenIds = useMemo(() => hiddenPeople(me.data?.hiddenMembers ?? [], people), [me.data, people]);
  const noKindFilter = useMemo(() => new Set<string>(), []);
  const items = useMemo(
    () => viewItemsOf(calendar.data, allGroups, me.data, hiddenIds, hidden, null, noKindFilter),
    [calendar.data, allGroups, me.data, hiddenIds, hidden, noKindFilter],
  );

  useAppFrame({ poolColors: poolColorsOf(allGroups, me.data) });

  const sections = useTodaySections();
  const prefs = me.data?.settings.todayPage ?? DEFAULT_TODAY_PAGE_PREFS;
  const manualOrder = me.data?.settings.extensionOrder ?? [];
  const setTodayPagePrefs = useSetTodayPagePrefs();

  const eventsSection = sections.find((x) => x.manifest.key === defaultExtension.manifest.key);
  const foldableAll = sections.filter((x) => x.manifest.key !== defaultExtension.manifest.key);
  const orderedKeys = orderTodaySectionKeys(
    foldableAll.map((x) => x.manifest.key),
    prefs.sortMode,
    manualOrder,
  );
  const foldableSections = useMemo(() => {
    const byKey = new Map(foldableAll.map((x) => [x.manifest.key, x]));
    return orderedKeys.flatMap((k) => {
      const x = byKey.get(k);
      return x ? [x] : [];
    });
  }, [foldableAll, orderedKeys]);
  const openKeys = useMemo(
    () => computeOpenSectionKeys(orderedKeys, prefs.openOverrides),
    [orderedKeys, prefs.openOverrides],
  );

  const toggleOpen = useCallback(
    (key: string) => {
      setTodayPagePrefs.mutate({
        ...prefs,
        openOverrides: { ...prefs.openOverrides, [key]: !openKeys.has(key) },
      });
    },
    [prefs, openKeys, setTodayPagePrefs],
  );

  const addNew = useCallback((d: Date) => setEditor({ mode: "new", date: d }), []);
  const open = useCallback((item: CalendarItem) => setEditor({ mode: "edit", item }), []);
  // 節の行を押して開くときだけ、行がそのままシートに広がる動き(共有要素)を使う。探した結果・
  // お知らせから開くとき(openSearchResult、openExt の下)は、押した行がいまの日に無いことがあるので使わない
  const openFromRow = useCallback((item: CalendarItem) => openRow(itemKey(item), () => open(item)), [openRow, open]);
  // 探した結果を押したとき。その項目の日へ移り、項目を出した拡張の編集のシートを開く。F-38、0046
  const openSearchResult = useCallback(
    (item: CalendarItem) => {
      update(startOfDay(new Date(item.startsAt)));
      open(item);
    },
    [update, open],
  );

  // お知らせを押して開いたとき。openExt の拡張の loadItem で 1 件読み、編集のシートを開く。#32
  // CalendarPage の同じ効果と同じ形。今日タブ(view を持たない `/`)にも通知が来るため、ここにも持つ
  const openExt = params.get("openExt");
  const openId = params.get("openId");
  useEffect(() => {
    if (!openExt || !openId) return;
    let cancelled = false;
    clientExtension(openExt)
      ?.loadItem?.(openId)
      .then((item) => {
        if (!cancelled) {
          update(startOfDay(new Date(item.startsAt)));
          setEditor({ mode: "edit", item });
        }
      })
      .catch(() => {
        if (!cancelled) toast.error("見つかりません。消されたか、見られなくなりました。");
      })
      .finally(() => {
        if (cancelled) return;
        setParams(
          (p) => {
            const q = new URLSearchParams(p);
            q.delete("openExt");
            q.delete("openId");
            return q;
          },
          { replace: true },
        );
      });
    return () => {
      cancelled = true;
    };
  }, [openExt, openId, setParams, update]);

  // 節の最後の行(近道)から、予定を足す。「/?new=1」は今までホーム画面のアイコン・放射が使っていたのと同じ道順
  const shortcutNew = params.get("new");
  useEffect(() => {
    if (!shortcutNew) return;
    addNew(date);
    setParams(
      (p) => {
        const q = new URLSearchParams(p);
        q.delete("new");
        return q;
      },
      { replace: true },
    );
    // date を依存に入れても、直後に shortcutNew を消すので、その後 date が変わっても再び足すことは無い
  }, [shortcutNew, addNew, setParams, date]);

  const onChangeDate = useCallback((dir: 1 | -1) => update(addDays(date, dir)), [update, date]);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const rowExpandValue = useMemo(() => rowExpandState(transitioningKey, editor !== null), [transitioningKey, editor]);
  const topBarVtStyle = useTopBarViewTransitionStyle();

  const editorKey = editor?.mode === "edit" ? editor.item.extension : defaultExtension.manifest.key;
  const Editor =
    editor?.mode === "edit" ? (clientExtension(editor.item.extension)?.Editor ?? null) : defaultExtension.Editor;
  const addons = sections.flatMap((x) =>
    (x.itemAddons ?? []).filter((a) => a.extension === editorKey).map((a) => a.Component),
  );

  return (
    <RowExpandContext.Provider value={rowExpandValue}>
      <header
        className="glass flex min-h-[58px] items-center justify-between gap-1 rounded-panel py-1.5 pr-1.5 pl-2"
        style={topBarVtStyle}
      >
        <Link
          to={`/spiral/${date.getFullYear()}`}
          aria-label="カレンダーを見る"
          className="grid size-11 place-items-center rounded-full text-ink-2"
        >
          <CalendarDays className="size-5" aria-hidden="true" />
        </Link>
        <div className="flex items-center gap-0.5">
          {me.data && <SearchButton groups={allGroups} me={me.data} onOpen={openSearchResult} />}
          <NotificationBell />
          <AccountMenu />
        </div>
      </header>

      <InstallBanner />
      {me.data && <UsualShareOfferBanner me={me.data} groups={allGroups} />}

      <DayFlipDeck
        date={date}
        reducedMotion={reducedMotion}
        onChangeDate={onChangeDate}
        renderPage={(d) => {
          const itemsForDay = items.filter((i) => onDay(i, d));
          return (
            <TodayDayContent
              date={d}
              today={today}
              weekItems={items}
              itemsForDay={itemsForDay}
              leaving={leaving}
              eventsSection={eventsSection}
              foldableSections={foldableSections}
              headlineExtension={prefs.headlineExtension}
              openKeys={openKeys}
              toggleOpen={toggleOpen}
              onSelectWeekDay={update}
              onOpenItem={openFromRow}
            />
          );
        }}
      />

      <div className="h-[var(--dock-clearance)]" aria-hidden="true" />

      {/*
        はじめての案内・画面の案内。0092 は今日のページに配線していなかった(困ること)。新しい見た目の
        既定の行き先がこのページになるため、CalendarPage と同じ形でここにも置く。issue #243
        設定から見直す間(URL に REOPEN_PARAM がある間)は、案内どうしが重ならないよう画面の案内を出さない
      */}
      {!editor && !params.has(REOPEN_PARAM) && <ScreenTour id="today" steps={BASE_TOURS.today} />}
      {me.data && <Onboarding me={me.data} paused={editor !== null} onAddEvent={() => addNew(today)} />}

      {editor && Editor && me.data && (
        <Editor
          key={editor.mode === "edit" ? `edit:${editor.item.extension}:${editor.item.id}` : "new"}
          target={editor}
          dayItemsOf={editor.mode === "new" ? (d) => items.filter((i) => !i.secondary && onDay(i, d)) : undefined}
          onOpenItem={(item) => setEditor({ mode: "edit", item })}
          groups={allGroups}
          me={me.data}
          onClose={() => {
            setEditor(null);
            resetRowExpand();
          }}
          onDelete={remove}
          addons={addons}
        />
      )}
    </RowExpandContext.Provider>
  );
}
