import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { cn } from "@/lib/utils";

/**
 * 色の丸から 1 つ選ぶ。矢印のキーでも選べる。
 *
 * 見た目の丸は 32px、押せる範囲は 44px。0012
 * 8 色あるときは、狭い幅で 4 色ずつ 2 段にそろえる。
 *
 * @param label 選択肢の名前。読み上げに使う
 * @param options 色の名前と、読み上げる日本語の名前
 */
export function ColorSwatches({
  value,
  options,
  onChange,
  label,
}: {
  value: string;
  options: readonly { key: string; label: string }[];
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <RadioGroupPrimitive.Root
      value={value}
      onValueChange={onChange}
      aria-label={label}
      className={cn(
        "flex flex-wrap gap-1.5",
        options.length > 6 && "max-[440px]:grid max-[440px]:grid-cols-[repeat(4,44px)] max-[440px]:gap-x-3.5",
      )}
    >
      {options.map((o) => (
        <RadioGroupPrimitive.Item
          key={o.key}
          value={o.key}
          aria-label={o.label}
          title={o.label}
          className={cn(
            "relative grid size-11 place-items-center rounded-full outline-none",
            "before:size-8 before:rounded-full before:bg-(--c) before:shadow-[inset_0_0_0_1px_rgba(0,0,0,.08)] before:content-['']",
            "data-[state=checked]:after:absolute data-[state=checked]:after:inset-px data-[state=checked]:after:rounded-full data-[state=checked]:after:border-2 data-[state=checked]:after:border-ink data-[state=checked]:after:content-['']",
            "focus-visible:ring-2 focus-visible:ring-ink",
            `c-${o.key}`,
          )}
        />
      ))}
    </RadioGroupPrimitive.Root>
  );
}
