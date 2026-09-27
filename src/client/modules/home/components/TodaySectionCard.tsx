/**
 * 今日のページの 1 節。見出し(機能の名前、押すとその機能の画面へ)、開く・畳む(山形、アイコンだけ。
 * 読み上げの名前は残す。issue #227 の返し)、中身(ext.today があればそれ、無ければ既定の節)、
 * 節の最後の行(その日にすぐ書く近道。ext.actions)を並べる。0092、issue #240
 */
import { defaultExtension } from "@extensions/client/registry";
import type { ClientExtension } from "@extensions/client/types";
import type { CalendarItem } from "@shared/api-types";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { MouseEvent } from "react";
import { Link } from "react-router";
import { markBoxExpandSource, useBoxExpandActive } from "@/lib/box-expand";
import { cn } from "@/lib/utils";
import type { ViewItem } from "@/modules/calendar/model";
import { DefaultTodaySection } from "./DefaultTodaySection";

export function TodaySectionCard({
  ext,
  date,
  isToday,
  isFuture,
  items,
  leaving,
  foldable = true,
  open,
  onToggleOpen,
  onOpenItem,
}: {
  ext: ClientExtension;
  date: Date;
  isToday: boolean;
  isFuture: boolean;
  items: ViewItem[];
  leaving?: Set<string>;
  /** false なら開閉のボタンを出さない(予定の節は畳めない、いまのホームの土台のウィジェットと同じ扱い) */
  foldable?: boolean;
  open: boolean;
  onToggleOpen: () => void;
  onOpenItem: (item: CalendarItem) => void;
}) {
  const label = ext.manifest.label;
  const actions = ext.actions ?? [];
  const Body = ext.today?.Component;
  // 節の見出しを押すと、その面がそのまま機能の画面に広がる動き(共有要素)。0044、0093、issue #241
  const boxExpandActive = useBoxExpandActive();
  const onNavClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (boxExpandActive) markBoxExpandSource(e.currentTarget);
  };
  return (
    <section
      data-testid={`today-section-${ext.manifest.key}`}
      className="glass rounded-panel px-4.5 py-3.5"
      aria-label={`${label}の節`}
    >
      <header className="flex items-center justify-between gap-2">
        {ext.nav ? (
          <Link
            to={ext.nav.path}
            viewTransition={boxExpandActive}
            onClick={onNavClick}
            className="min-w-0 truncate text-sm font-bold text-ink no-underline"
          >
            {label}
          </Link>
        ) : (
          <span className="min-w-0 truncate text-sm font-bold text-ink">{label}</span>
        )}
        {foldable && (
          <button
            type="button"
            aria-label={`${label}の節を${open ? "畳む" : "開く"}`}
            onClick={onToggleOpen}
            className="grid size-11 flex-none place-items-center rounded-(--r-field) text-ink-2"
          >
            {open ? (
              <ChevronUp className="size-4.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-4.5" aria-hidden="true" />
            )}
          </button>
        )}
      </header>
      {open && (
        <div className="mt-2">
          {Body ? (
            <Body date={date} isToday={isToday} dayItems={items} onOpenItem={onOpenItem} />
          ) : (
            <DefaultTodaySection
              ext={ext}
              isToday={isToday}
              isFuture={isFuture}
              items={items}
              leaving={leaving}
              onOpen={onOpenItem}
            />
          )}
          {actions.length > 0 && (
            <div
              className={cn(
                "flex flex-col",
                ext.manifest.key !== defaultExtension.manifest.key && "mt-1 border-t border-line pt-1",
              )}
            >
              {actions.map((a) => (
                <Link
                  key={a.label}
                  to={a.path}
                  data-testid={`today-quick-add-${ext.manifest.key}-${actions.indexOf(a)}`}
                  className="flex min-h-11 items-center gap-2 rounded-(--r-field) px-1 text-sm font-medium text-primary no-underline"
                >
                  <a.icon className="size-4 flex-none" aria-hidden="true" />
                  {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
