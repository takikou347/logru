import type { HomeWidgetProps } from "@extensions/client/types";
import { ShortcutLink } from "@/components/parts/ShortcutBand";
import { useKomaShortcut } from "./shortcut";

/**
 * 思い出の拡張の、ホームのウィジェット。近道の帯をそのまま使う。0029
 * いま押してほしい近道が無ければ、その旨を出す。
 */
export function MemoriesHomeWidget({ size }: HomeWidgetProps) {
  const shortcut = useKomaShortcut(true);
  if (!shortcut) {
    return (
      <p className="glass flex min-h-14 items-center rounded-[18px] px-4 text-[13px] text-ink-2">
        いま押してほしい近道はありません。
      </p>
    );
  }
  return <ShortcutLink shortcut={shortcut} compact={size === "small"} className="w-full" />;
}
