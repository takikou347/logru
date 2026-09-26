import { XIcon } from "lucide-react";
import { Dialog as ClosePrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * シート・ダイアログの右上の閉じるボタン(×)。`ResponsiveSheet`、`ui/dialog.tsx`、`ui/sheet.tsx`
 * が、これ 1 つの部品を使う。0067、0083、issue #223
 *
 * 見た目は丸い 36px。押せる範囲は見えない余白で 44px まで広げる(0012 と同じ考え)。
 * 地は `--field`(ガラスの上でも、ライト・ダークどちらでも × との比が見える濃さ)、
 * × は `size-5`・`text-ink-2`。押すと `Button` の active と同じ 0.97 倍に縮む。0044、0048
 *
 * `ui/sheet.tsx` の `SheetPrimitive` は、内側では `Dialog` と同じ Radix の部品を指す別名のため、
 * この部品はダイアログでもシートでも、そのまま `<CloseButton />` として置ける。
 * 位置(`absolute top-4 right-4` など)や、見出しの行に並べる置き方は呼び出し側の className で渡す。
 */
export function CloseButton({ className, ...props }: ComponentProps<typeof ClosePrimitive.Close>) {
  return (
    <ClosePrimitive.Close
      data-slot="close-button"
      className={cn(
        "group relative flex size-11 items-center justify-center rounded-full text-ink-2 outline-none transition-transform duration-fast ease-in-out active:not-disabled:scale-97 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* 見た目の地(36px)。押せる範囲(44px)はボタン自体が持つ、見えない余白 */}
      <span
        aria-hidden="true"
        className="absolute inset-[4px] rounded-full bg-field transition-colors duration-fast ease-in-out group-hover:bg-field-strong"
      />
      <XIcon className="relative z-1 size-5" />
      <span className="sr-only">閉じる</span>
    </ClosePrimitive.Close>
  );
}
