/**
 * ホームの土台のウィジェット。カレンダーの本体、選んだ日の予定、このあと。0001、0029
 * カレンダーの本体は外せない。ホーム側(HomePage.tsx)で、この key を並びから外させない
 */
import type { HomeWidget, HomeWidgetProps } from "@extensions/client/types";
import { HOME_CALENDAR_WIDGET_KEY } from "@shared/home";
import type { ReactNode } from "react";
import { DayPanel, ItemList } from "../calendar/components/DayItems";
import { MonthFlipDeck } from "../calendar/components/MonthFlipDeck";
import { WeekList } from "../calendar/components/WeekList";
import { useCalendarHome } from "./CalendarContext";

/** カレンダー本体。月の表(日めくりの 3D 送り。#99)か週の一覧を出す */
function CalendarBodyWidget() {
  const { view, days, today, selected, items, leaving, onPressDay, onSelectWeekDay, open, monthNav } =
    useCalendarHome();
  return (
    <div data-testid="widget-calendar">
      {view === "month" ? (
        <MonthFlipDeck
          monthAnchor={selected}
          today={today}
          selected={selected}
          items={items}
          leaving={leaving}
          onPressDay={onPressDay}
          onOpenItem={open}
          monthNav={monthNav}
        />
      ) : (
        <WeekList
          days={days}
          today={today}
          selected={selected}
          items={items}
          leaving={leaving}
          onSelect={onSelectWeekDay}
          onOpen={open}
        />
      )}
    </div>
  );
}

/** 月の表以外では、週や日の一覧がすでに同じ予定を出しているので、重ねて出さない */
function OnlyInMonthView({ editing, children }: { editing: boolean; children: ReactNode }) {
  const { view } = useCalendarHome();
  if (view === "month") return children;
  if (!editing) return null;
  return <p className="glass rounded-panel px-4.5 py-4 text-[13px] text-ink-2">月の表示のときだけ出ます。</p>;
}

/** 選んだ日の予定。大きな日付と、その日の予定。週・日の表示では、同じ予定が一覧に出るので隠す */
function DayPanelWidget({ editing }: HomeWidgetProps) {
  const { today, selected, items, leaving, open, onPressDay } = useCalendarHome();
  return (
    <OnlyInMonthView editing={editing}>
      <DayPanel
        day={selected}
        today={today}
        items={items}
        leaving={leaving}
        onOpen={open}
        onAddNew={() => onPressDay(selected)}
      />
    </OnlyInMonthView>
  );
}

/** このあと。近い順に 5 件。週・日の表示では隠す */
function UpcomingWidget({ editing }: HomeWidgetProps) {
  const { upcoming, leaving, open } = useCalendarHome();
  return (
    <OnlyInMonthView editing={editing}>
      <section className="glass rounded-panel px-4.5 py-4" aria-label="このあとの予定">
        <h2 className="mb-1 text-xs font-bold text-ink-2">このあと</h2>
        <ItemList items={upcoming} leaving={leaving} onOpen={open} empty="この期間に、このあとの予定はありません。" />
      </section>
    </OnlyInMonthView>
  );
}

/** ホームの土台のウィジェット。登録の順が、初めて開いたときの並びの先頭 3 つになる */
export const baseHomeWidgets: HomeWidget[] = [
  {
    key: HOME_CALENDAR_WIDGET_KEY,
    label: "カレンダー",
    description: "月・週・日の表。カレンダーの土台なので、外せません。",
    defaultPlaced: true,
    Component: CalendarBodyWidget,
  },
  {
    key: "home.day-panel",
    label: "選んだ日の予定",
    description: "選んでいる日の予定を、大きな日付と一緒に出します。",
    defaultPlaced: true,
    Component: DayPanelWidget,
  },
  {
    key: "home.upcoming",
    label: "このあと",
    description: "このあとに近い予定を、5 件まで出します。",
    defaultPlaced: true,
    Component: UpcomingWidget,
  },
];
