import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/**
 * スマホでは下から出るシート、PC では中央のダイアログ。0010
 *
 * 閉じると、開く前に押していたボタンに戻る。Esc でも閉じる。Tab はシートの中を回る。
 *
 * @param title 見出し。読み上げではこの名前のダイアログになる
 * @param description 見出しの下の説明。省ける
 * @param bar 見出しの上に並べる行。進み具合と「飛ばす」など。渡すと、右上の閉じるボタンは出さない
 * @param onClose 閉じるとき。外側を押したときと Esc のときも呼ぶ
 */
export function ResponsiveSheet({
  title,
  description,
  bar,
  onClose,
  children,
}: {
  title: string;
  description?: ReactNode;
  bar?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const onOpenChange = (open: boolean) => !open && onClose();
  const body = cn("glass flex flex-col gap-3.5 text-ink");
  const top = bar ? <div className="flex min-h-11 items-center justify-between gap-2">{bar}</div> : null;

  if (desktop) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={!bar}
          className={cn(
            body,
            "max-h-[calc(100dvh-48px)] overflow-y-auto rounded-panel border-(--glass-edge) bg-(--glass-flat) p-6 sm:max-w-[440px]",
          )}
        >
          {top}
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold">{title}</DialogTitle>
            {description ? (
              <DialogDescription className="text-ink-2">{description}</DialogDescription>
            ) : (
              <DialogDescription className="sr-only">{title}</DialogDescription>
            )}
          </DialogHeader>
          {children}
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={!bar}
        className={cn(
          body,
          "inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))] max-h-[calc(100dvh-24px)] overflow-y-auto rounded-[34px] border border-(--glass-edge) bg-(--glass-flat) px-5 pt-2.5 pb-5.5",
        )}
      >
        <div className="mx-auto h-[5px] w-[38px] shrink-0 rounded-full bg-line" aria-hidden="true" />
        {top}
        <SheetHeader className="p-0">
          <SheetTitle className="text-[17px] font-bold text-ink">{title}</SheetTitle>
          {description ? (
            <SheetDescription className="text-ink-2">{description}</SheetDescription>
          ) : (
            <SheetDescription className="sr-only">{title}</SheetDescription>
          )}
        </SheetHeader>
        {children}
      </SheetContent>
    </Sheet>
  );
}
