import { CalendarDays, House, Settings, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { useAppFrameAddables } from "@/components/layout/app-frame";
import { useNewLookActive } from "@/lib/lab";
import { useShowTabHints } from "@/lib/use-tab-hints";
import { cn } from "@/lib/utils";
import { RadialAddButton } from "./RadialAddButton";
import { TabIconButton } from "./TabIconButton";

/**
 * 画面の主な「足す」ボタンを置く帯。スマホは右下に浮かべ、PC は中身の末尾に並べる。0024、0062
 * カレンダー、思い出、家計簿、共有リストで共通に使う。左側の他の操作(月・週・日の切り替えなど)は
 * それぞれの画面が自分で組む。ここは主な操作(PrimaryAddButton)だけを包む。
 * @param label 読み上げでの名前
 * @param covered 新しい見た目のスマホでは、この帯の役目を GlobalBottomTabs の「+」が引き継ぐか。
 *   渡した画面は、新しい見た目・スマホでこの帯そのものを隠す。0091、issue #239
 */
export function Dock({
  label,
  children,
  className,
  covered,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  covered?: boolean;
}) {
  return (
    <div
      role="toolbar"
      aria-label={label}
      className={cn(
        "glass fixed right-4 bottom-[calc(24px+env(safe-area-inset-bottom))] z-20 flex items-center gap-1.5 rounded-full p-1.5",
        "lg:static lg:justify-end lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none lg:before:hidden",
        covered && "nl-hide",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * 下の帯。新しい見た目・スマホでだけ見せる、5 個のタブの帯(今日・カレンダー・+・機能・設定)。
 * 0090 の「浮いている」形の値(--float-bar-*)を使う。PC(1024px 以上)や、新しい見た目を
 * 入れていない人には出さない(.nl-only、globals.css)。0091、issue #239
 *
 * 「+」は、いま開いている画面が useAppFrame に渡した addables を放射で出す。渡していない画面
 * (設定、グループなど)では、渡すものが無く(決定 0086 と同じ扱い)、+ は出ない。
 */
export function GlobalBottomTabs() {
  const addables = useAppFrameAddables();
  const newLook = useNewLookActive();
  const showHint = useShowTabHints(newLook);
  return (
    <nav
      aria-label="下のタブ"
      className={cn(
        "nl-only fixed z-20 items-center gap-1 !shadow-[var(--float-bar-shadow)]",
        "glass inset-x-[var(--float-bar-inset)] bottom-[var(--float-bar-bottom)] h-[var(--float-bar-height)] rounded-[var(--float-bar-radius)] px-2",
      )}
    >
      <TabIconButton to="/" end icon={House} label="今日のページ" showHint={showHint} />
      <TabIconButton to="/?view=month" icon={CalendarDays} label="カレンダー" showHint={showHint} />
      <RadialAddButton addables={addables} showHint={showHint} />
      <TabIconButton to="/settings/extensions" icon={SlidersHorizontal} label="機能" showHint={showHint} />
      <TabIconButton to="/settings" icon={Settings} label="設定" showHint={showHint} />
    </nav>
  );
}
