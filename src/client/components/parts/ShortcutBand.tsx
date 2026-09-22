import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import type { ExtensionShortcut } from "@extensions/client/types";
import { useShortcut } from "@/lib/extensions";
import { cn } from "@/lib/utils";

/**
 * 近道の帯。拡張がいま押してほしいと返したものを 1 つだけ出す。F-26、0019
 * 返すものが無ければ何も出さない。押すと 1 タップでその画面へ移る。
 *
 * @param compact PC の左の列の形。題名と補足だけにし、右の操作の文字を省く
 */
export function ShortcutBand({ compact = false, className }: { compact?: boolean; className?: string }) {
  const shortcut = useShortcut();
  if (!shortcut) return null;
  return <ShortcutLink shortcut={shortcut} compact={compact} className={className} />;
}

/** 近道の帯の見た目。部品見本でも使う */
export function ShortcutLink({ shortcut, compact, className }: { shortcut: ExtensionShortcut; compact?: boolean; className?: string }) {
  const Icon = shortcut.icon;
  return (
    <Link
      to={shortcut.path}
      data-testid="shortcut-band"
      className={cn(
        "grid min-h-14 flex-none items-center gap-3 rounded-[18px] bg-primary py-1.5 pr-3 pl-1.5 text-primary-foreground no-underline",
        shortcut.image ? "grid-cols-[44px_1fr_auto]" : "grid-cols-[1fr_auto] pl-4",
        compact && "min-h-12 rounded-[14px] py-1 pr-2.5",
        className,
      )}
    >
      {shortcut.image && <img src={shortcut.image} alt="" className={cn("size-11 rounded-xl object-cover", compact && "size-9 rounded-[10px]")} />}
      <span className="flex min-w-0 flex-col">
        <b className={cn("truncate text-[15px]", compact && "text-[13px]")}>{shortcut.label}</b>
        <small className="truncate text-[11px] opacity-75">{shortcut.sub}</small>
      </span>
      {compact ? (
        <ChevronRight className="size-4" aria-hidden="true" />
      ) : (
        <span className="inline-flex items-center gap-1 text-[13px] font-bold">
          <Icon className="size-4" aria-hidden="true" />
          {shortcut.action}
        </span>
      )}
    </Link>
  );
}
