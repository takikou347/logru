import type { LucideIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * 1 つだけ選ぶ切り替え。月、週、日や、明るさに使う。
 * 読み上げでは、選択肢の中の 1 つとして伝わる。
 *
 * @param label 切り替えの名前。読み上げに使う
 * @param full 横いっぱいに広げ、選択肢を同じ幅にする
 * @param compact 選択肢の幅を詰める。スマホの下の操作に、ほかのボタンと並べるときに使う
 * @param iconOnly 選択肢を文字の代わりにアイコンだけで出す。選択肢に icon が要る。読み上げの名前は
 *   label のまま残す(aria-label)。新しい見た目・スマホの月週日の切り替えで使う。0091、issue #239
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  full,
  compact,
  iconOnly,
}: {
  value: T;
  options: readonly { value: T; label: string; icon?: LucideIcon }[];
  onChange: (v: T) => void;
  label: string;
  full?: boolean;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn(
        "rounded-full bg-line p-[3px]",
        full && "w-full",
        // Dock の帯はガラスで裏が薄く透けるので、地の色をここだけ濃く塗って字が透けないようにする。issue #202
        compact && "bg-(--ground)/55",
      )}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          aria-label={iconOnly ? o.label : undefined}
          className={cn(
            // 指の目安 44px。#22
            "min-h-11 min-w-12 rounded-full! border-0 px-3 text-sm font-medium text-ink-2 shadow-none",
            "data-[state=on]:bg-white data-[state=on]:text-ink data-[state=on]:shadow-[0_2px_6px_-2px_rgba(0,0,0,.3)]",
            "dark:data-[state=on]:bg-field-strong",
            full && "flex-1 text-[13px]",
            compact && "min-w-11 px-2",
            iconOnly && "min-w-11 px-0",
          )}
        >
          {iconOnly && o.icon ? <o.icon className="size-4.5" aria-hidden="true" /> : o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
