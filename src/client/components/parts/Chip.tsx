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
        // 押せないときは、選んでいないものだけを薄くする。選んでいるものは、いまの値として読めるように残す
        "disabled:cursor-default disabled:not-aria-checked:not-aria-pressed:opacity-45",
        // 押している間だけ 0.97 倍。0044、0048、#98
        "transition-transform duration-fast ease-in-out active:not-disabled:scale-97",
        className,
      )}
      {...props}
    />
  );
}
