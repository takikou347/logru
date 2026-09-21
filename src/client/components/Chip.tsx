import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * 丸い小さなボタン。グループの絞り込みや、予定のグループ選びに使う。
 * 押している間は aria-pressed か aria-checked を true にすると、テーマカラーで塗る。
 */
export function Chip({ className, ...props }: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex min-h-10 flex-none items-center gap-[7px] rounded-full border border-(--glass-edge) bg-field px-3.5 text-[13px] font-medium whitespace-nowrap",
        "aria-checked:border-primary aria-checked:bg-primary aria-checked:text-primary-foreground",
        "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground",
        className,
      )}
      {...props}
    />
  );
}
