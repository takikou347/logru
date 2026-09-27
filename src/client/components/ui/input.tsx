import type * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 入力欄。shadcn/ui の Input を、Logru の見た目に合わせる。
 * 文字は 16px にし、iPhone で押したときに画面が拡大されないようにする。
 *
 * iPhone の Safari は `type="date"` `type="time"` の中身の幅で外側の幅を決めがちで、
 * `width: 100%` を付けても隣の入力とそろわないことがある。既定の見た目(appearance)を消すと、
 * ほかの入力と同じく min-width: 0、width: 100% に従うようになる。#149
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "min-h-12 w-full min-w-0 rounded-(--r-field) border border-line bg-field px-3.5 text-base text-ink outline-none",
        "placeholder:text-ink-3 focus:border-ink focus:shadow-[0_0_0_3px_var(--line)]",
        "aria-invalid:border-sun aria-invalid:shadow-[0_0_0_3px_rgba(200,64,47,.14)]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        (type === "date" || type === "time" || type === "datetime-local") && "appearance-none",
        className,
      )}
      {...props}
    />
  );
}

/** 複数行の入力欄。メモに使う */
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "min-h-22 w-full resize-y rounded-(--r-field) border border-line bg-field px-3.5 py-3 text-base leading-relaxed text-ink outline-none",
        "placeholder:text-ink-3 focus:border-ink focus:shadow-[0_0_0_3px_var(--line)]",
        className,
      )}
      {...props}
    />
  );
}

export { Input, Textarea };
