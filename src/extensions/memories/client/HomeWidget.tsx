import type { LucideIcon } from "lucide-react";
import { Camera, ChevronRight, Timer } from "lucide-react";
import { Link } from "react-router";

/**
 * ホームから 1 回押すだけで移る、思い出のウィジェットの見た目。0029、0037
 * いつも同じ中身を出す。「いま」だけの近道は、カレンダーの上の帯(F-26)が受け持つ。
 */
function ActionWidget({
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

/** 「ひとコマ」。押すとひとコマの画面へ移る。F-128 */
export function KomaHomeWidget() {
  return <ActionWidget to="/memories/koma" icon={Timer} label="ひとコマ" hint="1 時間に 1 枚" testId="widget-koma" />;
}

/** 「記録する」。押すと記録のシートが開く。F-112 */
export function RecordHomeWidget() {
  return (
    <ActionWidget to="/memories?record=1" icon={Camera} label="記録する" hint="写真と一言" testId="widget-record" />
  );
}
