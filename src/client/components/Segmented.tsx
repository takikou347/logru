import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * 1 つだけ選ぶ切り替え。月、週、日や、明るさに使う。
 * 読み上げでは、選択肢の中の 1 つとして伝わる。
 *
 * @param label 切り替えの名前。読み上げに使う
 * @param full 横いっぱいに広げ、選択肢を同じ幅にする
 */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
  full,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
  full?: boolean;
}) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("rounded-full bg-line p-[3px]", full && "w-full")}
    >
      {options.map((o) => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          className={cn(
            "min-h-10 min-w-12 rounded-full! border-0 px-3 text-sm font-medium text-ink-2 shadow-none",
            "data-[state=on]:bg-white data-[state=on]:text-ink data-[state=on]:shadow-[0_2px_6px_-2px_rgba(0,0,0,.3)]",
            "dark:data-[state=on]:bg-field-strong",
            full && "flex-1 text-[13px]",
          )}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
