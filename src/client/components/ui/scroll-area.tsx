import * as React from "react"
import { ScrollArea as ScrollAreaPrimitive } from "radix-ui"
import { cn } from "@/lib/utils"

/**
 * 流れる欄。中身がはみ出すときだけ、スクロールバーを出す。0019
 * macOS と iPhone は、流している間しかバーを出さない。流せることに気づかせるため、自前で描く。
 * バーは中身に重ねて置くので、出ても出なくても欄の高さは変わらない。
 *
 * @param orientation 流れる向き。横ならバーを下に、縦なら右に出す
 */
function ScrollArea({
  className,
  children,
  orientation = "vertical",
  viewportClassName,
  scrollbarClassName,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
  orientation?: "vertical" | "horizontal"
  viewportClassName?: string
  /** バーの置き場所を変える。横の欄で、左右の余白に合わせるときに使う */
  scrollbarClassName?: string
}) {
  return (
    <ScrollAreaPrimitive.Root data-slot="scroll-area" type="auto" className={cn("relative overflow-hidden", className)} {...props}>
      <ScrollAreaPrimitive.Viewport
        data-slot="scroll-area-viewport"
        className={cn("size-full rounded-[inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50", viewportClassName)}
      >
        {children}
      </ScrollAreaPrimitive.Viewport>
      <ScrollBar orientation={orientation} className={scrollbarClassName} />
    </ScrollAreaPrimitive.Root>
  )
}

/** バー。つまみの幅は 6 px、色は地の文字の 20%。溝は線の色 */
function ScrollBar({ className, orientation = "vertical", ...props }: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
  return (
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      data-slot="scroll-area-scrollbar"
      orientation={orientation}
      className={cn(
        "flex touch-none select-none",
        orientation === "vertical" && "h-full w-2 py-0.5 pr-0.5",
        orientation === "horizontal" && "h-2 flex-col pt-1",
        className,
      )}
      {...props}
    >
      <div className={cn("absolute rounded-full bg-line", orientation === "vertical" ? "inset-y-0.5 right-0.5 w-1.5" : "inset-x-0 bottom-0 h-1")} aria-hidden="true" />
      <ScrollAreaPrimitive.ScrollAreaThumb
        data-slot="scroll-area-thumb"
        className="relative flex-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_22%,transparent)]"
      />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  )
}

export { ScrollArea, ScrollBar }
