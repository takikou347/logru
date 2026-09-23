import { cn } from "@/lib/utils";

/** 薄い面。光が流れる表現は使わない。動くのは opacity のパルスだけ。0044、0048、#98 */
function Block({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("animate-pulse rounded-xl bg-field", className)} />;
}

/**
 * カレンダーの骨組み。ログインした人だけの画面を開いたとき、中身が届くまでの一瞬だけ出す。
 * 「読み込んでいます」の文字の代わりに、月の表と選んだ日の予定の形を薄い面で示す。
 * 光が流れる表現(シマー)は、ガラスを描き直すので使わない。0010、0044、0048、#98
 */
export function CalendarSkeleton() {
  return (
    <div
      role="status"
      aria-label="読み込んでいます"
      className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-3 px-4 pt-[max(16px,env(safe-area-inset-top))] pb-[calc(120px+env(safe-area-inset-bottom))]"
    >
      {/* 上の帯 */}
      <div className="glass flex min-h-[58px] items-center gap-2 rounded-panel py-1.5 pr-1.5 pl-4">
        <Block className="h-9 w-24" />
        <div className="ml-auto flex gap-1.5">
          <Block className="size-9 rounded-full" />
          <Block className="size-9 rounded-full" />
          <Block className="size-9 rounded-full" />
        </div>
      </div>

      {/* 月の表 */}
      <div className="glass flex flex-col gap-2.5 rounded-panel px-2 pt-2.5 pb-2">
        <div className="grid grid-cols-7 gap-1.5 px-1">
          {Array.from({ length: 7 }, (_, i) => (
            <Block key={i} className="h-3" />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 px-1 pb-1">
          {Array.from({ length: 35 }, (_, i) => (
            <Block key={i} className="h-9" />
          ))}
        </div>
      </div>

      {/* 選んだ日の予定 */}
      <div className="glass grid grid-cols-[auto_1fr] items-start gap-4 rounded-panel px-4.5 py-4">
        <Block className="h-[72px] w-[60px]" />
        <div className="flex flex-col gap-2 pt-1">
          <Block className="h-4 w-full" />
          <Block className="h-4 w-4/5" />
          <Block className="h-4 w-3/5" />
        </div>
      </div>
    </div>
  );
}
