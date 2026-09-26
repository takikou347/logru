import { XIcon } from "lucide-react";
import { type AnimationEvent, type ReactNode, useEffect } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { sheetOpened } from "@/lib/pwa-update";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** `<input>` の、日付・時刻を選ぶネイティブな型 */
const DATE_LIKE_INPUT_TYPES = new Set(["date", "time", "datetime-local", "month", "week"]);

/**
 * iPhone の Safari は、日付・時刻の入力欄のネイティブな選択 UI を閉じるとき、シートの外側で
 * 起きたように見えるポインター・フォーカスの動きを送ることがある。Radix の Dialog・Sheet は
 * それを「外側を押した」と見なして、日付を選んだ直後にシートを閉じてしまう。
 *
 * 外側の動きが起きた時点で日付・時刻の入力欄にまだフォーカスが残っていれば、ネイティブな UI の
 * 後始末とみなし、閉じるのをやめる。ふさわしくない動きは防げないが、フォームの入力を保つ方を選ぶ。
 */
function keepOpenWhileDateInputFocused(event: { preventDefault: () => void }) {
  const active = document.activeElement;
  if (active instanceof HTMLInputElement && DATE_LIKE_INPUT_TYPES.has(active.type)) {
    event.preventDefault();
  }
}

/** 閉じるボタン(X)の見た目。ガラスの面(position: relative)の右上に留める */
const CLOSE_BUTTON_CLASS =
  "absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none";

/**
 * スマホでは下から出るシート、PC では中央のダイアログ。0010
 *
 * 閉じると、開く前に押していたボタンに戻る。Esc でも閉じる。Tab はシートの中を回る。
 *
 * 見出しと閉じるボタンの行、やめる・保存するなどの下の行(footer)はシートの上下に留め、
 * 中身(children)だけが縦に流れる。#149、#192
 * シートの高さの上限は、画面の高さから上の安全な余白(--safe-top)と 12px を引いた値にする。
 * iPhone の PWA では、この余白が無いと高いシートで閉じるボタンが物理の切り欠きの下に隠れる。
 *
 * `open` を渡すと、閉じる動きを Radix の Presence に任せる。呼び出し側は Esc・外側・X を押されたら
 * `onOpenChange` で自分の開閉の状態を false にし、動きが終わったらこの部品が `onClose` を呼ぶ。
 * `open` を渡さなければ、これまでと同じく押した瞬間に `onClose` を呼ぶ(動きは待たない)。#192
 *
 * @param title 見出し。読み上げではこの名前のダイアログになる
 * @param description 見出しの下の説明。省ける
 * @param bar 見出しの上に並べる行。進み具合と「飛ばす」など。渡すと、右上の閉じるボタンは出さない
 * @param footer やめる・保存するなどの行。渡すと、シートの下に留まる。省くと、これまでと同じく中身の続きに流れる
 * @param onClose 閉じるとき。`open` を渡さなければ Esc・外側・X を押した瞬間に呼ぶ。
 *   `open` を渡すと、閉じる動きが終わってから呼ぶ
 * @param fullScreen スマホでは画面いっぱいに広げる。文字盤が出ても入力欄と結果が隠れにくい。探すのシートで使う。issue #23
 * @param open 呼び出し側が持つ、開いているかどうか。渡すと閉じる動きを待つ形になる。#192
 * @param onOpenChange Esc・外側・X を押したとき。`open` を渡したときだけ使う
 */
export function ResponsiveSheet({
  title,
  description,
  bar,
  footer,
  onClose,
  children,
  fullScreen,
  open: openProp,
  onOpenChange: onOpenChangeProp,
}: {
  title: string;
  description?: ReactNode;
  bar?: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  fullScreen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  // 新しい版が出ても、開いている間は読み込み直しを延ばす。0073
  useEffect(() => sheetOpened(), []);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : true;

  const onOpenChange = (next: boolean) => {
    if (next) return;
    if (controlled) onOpenChangeProp?.(false);
    else onClose();
  };
  /** 閉じる動きが終わった瞬間だけ、親に知らせる。開く動きの終わりでは呼ばない。#192 */
  function onMotionEnd(e: AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (controlled && !open && e.currentTarget.dataset.state === "closed") onClose();
  }

  const panel = "glass flex flex-col gap-3.5 text-ink";
  // 中身だけを流す欄。見出しと閉じるボタンの行、下の footer が属す flex の gap-3.5 と同じ間隔を、この中でも保つ
  const scrollBody = "flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto";
  const top = bar ? <div className="flex min-h-11 items-center justify-between gap-2">{bar}</div> : null;
  const showCloseButton = !bar;

  if (desktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          onInteractOutside={keepOpenWhileDateInputFocused}
          onAnimationEnd={onMotionEnd}
          className="gap-0 rounded-none border-0 bg-transparent p-0 shadow-none sm:max-w-[440px]"
        >
          <div
            className={cn(
              panel,
              "max-h-[calc(100dvh-48px)] overflow-hidden rounded-panel border-(--glass-edge) bg-(--glass-flat) p-6",
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
            <div className={scrollBody}>{children}</div>
            {footer}
            {/* 見出しなど他の中身より後ろに置く。同じ position: relative の兄弟は DOM の後の方が上に重なるため */}
            {showCloseButton && (
              <DialogClose className={CLOSE_BUTTON_CLASS}>
                <XIcon className="size-4" />
                <span className="sr-only">閉じる</span>
              </DialogClose>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        onInteractOutside={keepOpenWhileDateInputFocused}
        onAnimationEnd={onMotionEnd}
        className={cn(
          "gap-0 border-t-0 bg-transparent shadow-none",
          fullScreen ? "inset-0" : "inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))]",
        )}
      >
        <div
          className={cn(
            panel,
            "overflow-hidden",
            fullScreen
              ? "h-full max-h-full rounded-none border-0 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]"
              : "max-h-[calc(100dvh-var(--safe-top)-12px)] rounded-[34px] border border-(--glass-edge) bg-(--glass-flat) px-5 pt-2.5 pb-5.5",
          )}
        >
          {top}
          <SheetHeader className="p-0">
            <SheetTitle className="text-[17px] font-bold text-ink">{title}</SheetTitle>
            {description ? (
              <SheetDescription className="text-ink-2">{description}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </SheetHeader>
          <div className={scrollBody}>{children}</div>
          {footer}
          {/* 見出しなど他の中身より後ろに置く。同じ position: relative の兄弟は DOM の後の方が上に重なるため */}
          {showCloseButton && (
            <SheetClose className={CLOSE_BUTTON_CLASS}>
              <XIcon className="size-4" />
              <span className="sr-only">閉じる</span>
            </SheetClose>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
