/**
 * ホームのウィジェットのカード。アイコン・題・値・行き先を持つ。0081、issue #207
 *
 * 家計簿・共有リスト・思い出のウィジェットが同じ形(`glass grid` …)を 6 か所に書き写していたのを、
 * ここへまとめる。値には、読み込み中(「…」)や失敗(「読み込めません」)の文もそのまま渡す。
 */
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";

export function HomeWidgetCard({
  to,
  icon: Icon,
  label,
  hint,
  testId,
}: {
  to: string;
  icon: LucideIcon;
  label: string;
  hint: string;
  testId: string;
}) {
  return (
    <Link
      to={to}
      data-testid={testId}
      className="glass grid min-h-16 grid-cols-[44px_1fr_auto] items-center gap-3 rounded-panel py-2.5 pr-3 pl-2.5 text-ink no-underline"
    >
      <span className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col">
        <b className="truncate text-[15px]">{label}</b>
        <small className="truncate text-xs text-ink-2">{hint}</small>
      </span>
      <ChevronRight className="size-5 text-ink-2" aria-hidden="true" />
    </Link>
  );
}
