import { Bell, ChevronRight, HelpCircle, Palette, SlidersHorizontal, UserRound } from "lucide-react";
import { NavLink } from "react-router";
import { sideItemClass } from "@/components/layout/AppLayout";
import { cn } from "@/lib/utils";

/**
 * 設定の目次。見た目、通知、機能、使い方、アカウントの 5 つ。issue #102
 * 先頭は PC で `/settings` を開いたときに移る先にもなる。
 */
export const SETTINGS_SECTIONS = [
  { path: "/settings/appearance", label: "見た目", description: "明るさ、色、アバター", icon: Palette },
  { path: "/settings/notifications", label: "通知", description: "この端末の通知", icon: Bell },
  { path: "/settings/extensions", label: "機能", description: "使う機能を選ぶ", icon: SlidersHorizontal },
  { path: "/settings/usage", label: "使い方", description: "案内、よくある質問", icon: HelpCircle },
  { path: "/settings/account", label: "アカウント", description: "表示名、ログインの方法", icon: UserRound },
] as const;

/**
 * 設定の目次。
 * @param variant side は PC の左の列に足す短い並び。menu はスマホの `/settings` に出す、大きく押せる並び
 */
export function SettingsToc({ variant }: { variant: "side" | "menu" }) {
  if (variant === "side") {
    return (
      <nav aria-label="設定の目次">
        {SETTINGS_SECTIONS.map((s) => (
          <NavLink key={s.path} className={sideItemClass} to={s.path}>
            <s.icon className="size-4" aria-hidden="true" />
            {s.label}
          </NavLink>
        ))}
      </nav>
    );
  }
  return (
    <ul aria-label="設定の目次" className="flex flex-col">
      {SETTINGS_SECTIONS.map((s) => (
        <li key={s.path} className="border-line not-first:border-t">
          <NavLink
            to={s.path}
            className={cn("grid min-h-15 grid-cols-[40px_1fr_auto] items-center gap-3 no-underline")}
          >
            <span
              className="grid size-10 place-items-center rounded-xl border border-line bg-field-strong"
              aria-hidden="true"
            >
              <s.icon className="size-5" />
            </span>
            <span className="flex min-w-0 flex-col">
              <b className="text-[15px]">{s.label}</b>
              <small className="truncate text-xs text-ink-2">{s.description}</small>
            </span>
            <ChevronRight className="size-4 text-ink-3" aria-hidden="true" />
          </NavLink>
        </li>
      ))}
    </ul>
  );
}
