import { type AnimationEvent, type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
import { CloseButton } from "@/components/parts/CloseButton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { DATE_LIKE_INPUT_TYPES } from "@/lib/date-like-inputs";
import { useKeyboardViewport } from "@/lib/keyboard-viewport";
import { useNewLookActive } from "@/lib/lab";
import { sheetOpened } from "@/lib/pwa-update";
import { useSheetExpandName } from "@/lib/row-expand";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

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

/**
 * 閉じる動き(--dur-base、220ms)より長く待っても `animationend` が来なければ、代わりに呼ぶ。
 * ヘッドレスの Chromium では、裏で他の描き直しが起きている間、短い CSS animation の
 * `animationend` がすぐには届かないことがある。そのままだと `onClose` が呼ばれず、
 * 閉じたはずのシートが `data-state="closed"`・`pointer-events-none` のまま居座り続ける。#211
 */
const CLOSE_FALLBACK_MS = 400;

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
 * 新しい見た目・スマホでは、OS のキーボードが出ると `visualViewport` を見てシートの下端を
 * キーボードの上端に合わせる(`keyboard-viewport.ts`)。footer に `SheetFooterActions` を渡していれば、
 * そちら側でキーボードの上の帯(前の欄・次の欄・保存)に切り替わる。0094、issue #242
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
 * @param viewTransitionName 行がそのままシートに広がる動き(共有要素)の名前。押した行と同じ名前を
 *   渡すと、View Transitions API が位置と大きさをつなげる。渡さなければ、開いた行の呼び出し側が
 *   RowExpandContext(lib/row-expand.ts)に積んだ名前を使う。どちらも無ければ名前を付けない。0044、0093
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
  viewTransitionName,
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
  viewTransitionName?: string;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const ctxViewTransitionName = useSheetExpandName();
  const vtName = viewTransitionName ?? ctxViewTransitionName;
  const vtStyle = vtName ? { viewTransitionName: vtName } : undefined;
  // 新しい版が出ても、開いている間は読み込み直しを延ばす。0073
  useEffect(() => sheetOpened(), []);

  // OS のキーボードが出たら、シートの下端をキーボードの上端にぴったり合わせて持ち上げる。新しい見た目・
  // スマホだけ(入れていない人と PC には効かせない)。fullScreen のシートには適用しない(既に画面いっぱい)。
  // 0094、issue #242
  const newLook = useNewLookActive();
  const keyboard = useKeyboardViewport(newLook && !desktop);
  const followKeyboard = keyboard.open && !fullScreen;
  const KEYBOARD_TRANSITION = "var(--dur-keyboard) var(--ease-keyboard)";
  // シートの下端を、キーボードの上端(liftPx)にそのまま合わせる。8px の余白は、キーボードが
  // 覆っている間は要らない(その分の隙間が背景を覗かせてしまう)。#242 のレビューで分かった
  const sheetBottomStyle: CSSProperties | undefined = followKeyboard
    ? { bottom: keyboard.liftPx, transition: `bottom ${KEYBOARD_TRANSITION}` }
    : undefined;
  // シートの高さの上限も、キーボードの高さぶん削る。削らずに下端だけ動かすと、シートの上端が
  // 画面の外へ押し出され、上の方の欄(金額など)が見えなくなる。#242 のレビューで分かった
  const panelMaxHeightStyle: CSSProperties | undefined = followKeyboard
    ? {
        maxHeight: `calc(100dvh - var(--safe-top) - 12px - ${keyboard.liftPx}px)`,
        transition: `max-height ${KEYBOARD_TRANSITION}`,
      }
    : undefined;

  // 帯(footer)の高さを測り、キーボードが出ている間はスクロールする中身の下にその高さぶんの
  // 余白を足す。無いと、最後の欄が帯に接して半分隠れる。#242 のレビューで分かった
  const footerRef = useRef<HTMLDivElement>(null);
  const [footerHeight, setFooterHeight] = useState(0);
  useEffect(() => {
    const el = footerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setFooterHeight(entry.contentRect.height);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const scrollBodyStyle: CSSProperties | undefined = followKeyboard
    ? { paddingBottom: footerHeight, transition: `padding-bottom ${KEYBOARD_TRANSITION}` }
    : undefined;

  // いま入力中の欄が、この持ち上がったシートの見える範囲に入るよう、シートの中のスクロールだけで
  // 動かす(画面全体は動かさない)。キーボードが出た瞬間と、シートの中でフォーカスが移るたびに行う。#242
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!followKeyboard) return;
    const root = panelRef.current;
    if (!root) return;
    const scrollActiveIntoView = () => {
      const active = document.activeElement;
      if (active instanceof HTMLElement && root.contains(active)) {
        active.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    };
    scrollActiveIntoView();
    root.addEventListener("focusin", scrollActiveIntoView);
    return () => root.removeEventListener("focusin", scrollActiveIntoView);
  }, [followKeyboard]);

  const controlled = openProp !== undefined;
  const open = controlled ? openProp : true;

  // onClose は 1 回だけ呼ぶ。animationend と、保険のタイマーの両方から呼べるため。
  // ref に包み、依存の配列を気にせず使えるようにする。#211
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnceRef = useRef(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current();
  });
  useEffect(() => {
    if (open) closedRef.current = false;
  }, [open]);

  // 閉じ始めたら(open が false になったら)、animationend が来なくても保険で呼ぶ。#211
  useEffect(() => {
    if (!controlled || open) return;
    const timer = window.setTimeout(() => closeOnceRef.current(), CLOSE_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [controlled, open]);

  const onOpenChange = (next: boolean) => {
    if (next) return;
    if (controlled) onOpenChangeProp?.(false);
    else closeOnceRef.current();
  };
  /** 閉じる動きが終わった瞬間だけ、親に知らせる。開く動きの終わりでは呼ばない。#192 */
  function onMotionEnd(e: AnimationEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return;
    if (controlled && !open && e.currentTarget.dataset.state === "closed") closeOnceRef.current();
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
            style={vtStyle}
          >
            {top}
            <DialogHeader>
              <DialogTitle className={cn("text-[17px] font-bold", showCloseButton && "pr-9")}>{title}</DialogTitle>
              {description ? (
                <DialogDescription className="text-ink-2">{description}</DialogDescription>
              ) : (
                <DialogDescription className="sr-only">{title}</DialogDescription>
              )}
            </DialogHeader>
            <div className={scrollBody}>{children}</div>
            {footer}
            {/* DOM の後ろに置く。footer の中の明示の「閉じる」ボタンより読み上げの順を後にするため。#223 */}
            {showCloseButton && <CloseButton className="absolute top-3.5 right-4" />}
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        onInteractOutside={keepOpenWhileDateInputFocused}
        onAnimationEnd={onMotionEnd}
        className={cn(
          "gap-0 border-t-0 bg-transparent shadow-none",
          fullScreen ? "inset-0" : "inset-x-2 bottom-[calc(8px+env(safe-area-inset-bottom))]",
        )}
        style={sheetBottomStyle}
      >
        <div
          ref={panelRef}
          className={cn(
            panel,
            "overflow-hidden",
            fullScreen
              ? "h-full max-h-full rounded-none border-0 px-5 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]"
              : "max-h-[calc(100dvh-var(--safe-top)-12px)] rounded-[34px] border border-(--glass-edge) bg-(--glass-flat) px-5 pt-2.5 pb-5.5",
          )}
          style={{ ...panelMaxHeightStyle, ...vtStyle }}
        >
          {top}
          <SheetHeader className="p-0">
            <SheetTitle className={cn("text-[17px] font-bold text-ink", showCloseButton && "pr-9")}>{title}</SheetTitle>
            {description ? (
              <SheetDescription className="text-ink-2">{description}</SheetDescription>
            ) : (
              <SheetDescription className="sr-only">{title}</SheetDescription>
            )}
          </SheetHeader>
          <div className={scrollBody} style={scrollBodyStyle}>
            {children}
          </div>
          {footer && <div ref={footerRef}>{footer}</div>}
          {/* DOM の後ろに置く。footer の中の明示の「閉じる」ボタンより読み上げの順を後にするため。#223 */}
          {showCloseButton && <CloseButton className="absolute top-2.5 right-4" />}
        </div>
      </SheetContent>
    </Sheet>
  );
}
