/**
 * 行を左へ引くと「直す」「消す」が出る共通の部品。0084、#225
 *
 * pointer: fine で hover できる端末(PC)では、行に乗せる・フォーカスするとボタンが小さく出る。
 * それ以外(スマホなど)では、Pointer Events での横スワイプでボタンを出す。専用のライブラリは使わない。
 * 並べ替えの `use-pointer-reorder.ts` と同じ考え方。
 *
 * `onEdit` を渡さないと「消す」だけになる(しおりの項目のように、その場で直す形が無い画面向け)。
 *
 * ラボの「新しい見た目」を入れた人は、スワイプで出る「直す」「消す」も PC の乗せて出す方と同じ
 * アイコンだけにする(読み上げの名前は残す)。入れていない人には 1px も変えない。issue #243
 */
import { Pencil, Trash2 } from "lucide-react";
import {
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNewLookActive } from "@/lib/lab";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";

/** 行の幅に対して、これだけ引き切ると消す。0084 */
const COMMIT_RATIO = 0.6;
/** 横に引いたと見なす、指の動きのしきい値(px)。これより小さい動きでは縦か横かを決めない */
const DIRECTION_LOCK_PX = 8;
/** ボタン 1 つぶんの幅。w-[72px] と同じ値。0084 */
const ACTION_BUTTON_WIDTH = 72;
/**
 * ラボの「新しい見た目」を入れた人は、開いた・引いている間の中身の左へのずれをこの値までに留める。
 * 行の幅ぶん引ききって消す動き(rowWidth * COMMIT_RATIO を超える)は、この上限を掛けず、
 * 今までどおり最後まで指に追従させる。issue #243
 */
const CONTENT_SHIFT_CAP = 16;

type OpenRow = { id: string; close: () => void };
/** 開いている行は 1 つだけ。新しく開くとき、これを見てほかを閉じる。0084 */
let openRow: OpenRow | null = null;

function closeOtherRows(id: string) {
  if (openRow && openRow.id !== id) openRow.close();
}
function registerOpenRow(row: OpenRow) {
  openRow = row;
}
function clearOpenRow(id: string) {
  if (openRow?.id === id) openRow = null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export type SwipeRowProps = {
  /** ほかの開いている行を閉じるための、行を見分ける鍵。同じ画面で重ならない値にする */
  id: string;
  /** 「直す」。渡さないと「消す」だけになる */
  onEdit?: () => void;
  onDelete: () => void;
  /** ボタンの読み上げ。既定は「直す」「消す」で足りるので、項目の名前などで上書きしたいときだけ渡す */
  editLabel?: string;
  deleteLabel?: string;
  children: ReactNode;
  className?: string;
};

export function SwipeRow({
  id,
  onEdit,
  onDelete,
  editLabel = "直す",
  deleteLabel = "消す",
  children,
  className,
}: SwipeRowProps) {
  // PC(pointer: fine、hover できる)では、スワイプではなく行に乗せる・フォーカスするだけで出す。0084
  const canHover = useMediaQuery("(hover: hover) and (pointer: fine)");

  if (canHover) {
    return (
      <div className={cn("group/swipe-row relative flex items-stretch gap-1", className)}>
        <div className="min-w-0 flex-1">{children}</div>
        <div className="flex flex-none items-center gap-0.5">
          {onEdit && (
            <button
              type="button"
              aria-label={editLabel}
              onClick={onEdit}
              className="grid size-9 place-items-center rounded-(--r-field) text-ink-2 opacity-0 transition-opacity duration-fast ease-out group-hover/swipe-row:opacity-100 group-focus-within/swipe-row:opacity-100 hover:bg-field"
            >
              <Pencil className="size-4" />
            </button>
          )}
          <button
            type="button"
            aria-label={deleteLabel}
            onClick={onDelete}
            className="grid size-9 place-items-center rounded-(--r-field) text-sun opacity-0 transition-opacity duration-fast ease-out group-hover/swipe-row:opacity-100 group-focus-within/swipe-row:opacity-100 hover:bg-field"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <TouchSwipeRow
      id={id}
      onEdit={onEdit}
      onDelete={onDelete}
      editLabel={editLabel}
      deleteLabel={deleteLabel}
      className={className}
    >
      {children}
    </TouchSwipeRow>
  );
}

type DragState = { pointerId: number; startX: number; startY: number; axis: "x" | "y" | null; base: number };

function TouchSwipeRow({
  id,
  onEdit,
  onDelete,
  editLabel,
  deleteLabel,
  children,
  className,
}: Omit<SwipeRowProps, "editLabel" | "deleteLabel"> & { editLabel: string; deleteLabel: string }) {
  const iconOnly = useNewLookActive();
  // ボタンの数から幅を決める。実際の DOM 幅の計測(ドラッグの物差しに使う actionsRef の測定)とは別に、
  // 「引ききって消す動きか、直す・消すを開く動きか」を見分けるためだけに使う
  const actionsWidth = (onEdit ? 2 : 1) * ACTION_BUTTON_WIDTH;
  const rowRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [open, setOpen] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  // イベントの外(window の pointermove/up)から常に最新の値を読むための写し
  const dragXRef = useRef(0);
  const setPos = useCallback((v: number) => {
    dragXRef.current = v;
    setDragX(v);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setPos(0);
  }, [setPos]);

  // 開いている間だけ、外を押すと閉じる。ほかの行が開いたら、この行も閉じる。0084
  useEffect(() => {
    if (!open) return;
    registerOpenRow({ id, close });
    const onOutside = (e: globalThis.PointerEvent) => {
      if (rowRef.current && !rowRef.current.contains(e.target as Node)) close();
    };
    window.addEventListener("pointerdown", onOutside);
    return () => {
      window.removeEventListener("pointerdown", onOutside);
      clearOpenRow(id);
    };
  }, [open, id, close]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      axis: null,
      base: dragXRef.current,
    };
  }, []);

  useEffect(() => {
    const onMove = (e: globalThis.PointerEvent) => {
      const st = dragRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (st.axis === null) {
        if (Math.abs(dx) < DIRECTION_LOCK_PX && Math.abs(dy) < DIRECTION_LOCK_PX) return;
        // 横の動きが縦より大きいときだけ引く。縦のスクロールは邪魔しない(touch-action: pan-y)。0084
        st.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (st.axis === "x") {
          closeOtherRows(id);
          setDragging(true);
        }
      }
      if (st.axis !== "x") return;
      e.preventDefault();
      const actionsWidth = actionsRef.current?.getBoundingClientRect().width ?? 0;
      const rowWidth = rowRef.current?.getBoundingClientRect().width ?? 0;
      const maxDrag = Math.max(actionsWidth, rowWidth * COMMIT_RATIO + 24);
      setPos(clamp(st.base + dx, -maxDrag, 0));
    };

    const onUp = (e: globalThis.PointerEvent) => {
      const st = dragRef.current;
      if (!st || e.pointerId !== st.pointerId) return;
      dragRef.current = null;
      setDragging(false);
      if (st.axis !== "x") return;
      const rowWidth = rowRef.current?.getBoundingClientRect().width ?? 0;
      const actionsWidth = actionsRef.current?.getBoundingClientRect().width ?? 0;
      const x = Math.abs(dragXRef.current);
      if (x >= rowWidth * COMMIT_RATIO) {
        // 引き切ったら消す。行はそのまま滑り切らせ、消える動きは呼び出し側(leaving)に任せる
        setPos(-rowWidth);
        onDelete();
      } else if (x > actionsWidth / 2) {
        setOpen(true);
        setPos(-actionsWidth);
      } else {
        setOpen(false);
        setPos(0);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [id, onDelete, setPos]);

  return (
    <div
      ref={rowRef}
      data-testid="swipe-row"
      // 指は行のどこから引いても拾う。戻る動きの途中や開いているときは、右端に「直す」「消す」が
      // 出ているので、中身だけで拾うとそこから引いた指を取りこぼす。押すだけならボタンの click はそのまま動く
      className={cn("relative touch-pan-y overflow-hidden", className)}
      data-swipe-open={open || undefined}
      onPointerDown={onPointerDown}
    >
      <div
        ref={actionsRef}
        className="absolute inset-y-0 right-0 flex"
        style={{
          // 閉じているときは自分の幅ぶん右へ出し、overflow-hidden の外に隠す。0084
          transform: `translateX(calc(100% + ${dragX}px))`,
          transition: dragging ? "none" : "transform var(--dur-base) var(--ease-out)",
        }}
      >
        {onEdit && (
          <button
            type="button"
            aria-label={editLabel}
            onClick={() => {
              onEdit();
              close();
            }}
            className="flex w-[72px] flex-none items-center justify-center bg-field-strong text-sm font-bold text-ink"
          >
            {iconOnly ? <Pencil className="size-4" aria-hidden="true" /> : editLabel}
          </button>
        )}
        <button
          type="button"
          aria-label={deleteLabel}
          // 消す動きは呼び出し側の leaving に任せる。ここでは位置を戻さず、開いたまま消えていく
          onClick={onDelete}
          className="flex w-[72px] flex-none items-center justify-center bg-destructive text-sm font-bold text-destructive-foreground"
        >
          {iconOnly ? <Trash2 className="size-4" aria-hidden="true" /> : deleteLabel}
        </button>
      </div>
      {(() => {
        // 新しい見た目では、開いた・引いている間、中身の左へのずれを小さく留め(項目名やチェックが
        // 消えて見えないようにする)、代わりに幅を引ききった分だけ狭める。中身の押せる範囲(1fr の
        // 列いっぱいに伸びるボタンなど)が、右に出た「直す」「消す」の上まで伸びて奪い合わないようにする。
        // 行の幅ぶん引ききって消す動きは、今までどおり最後まで指に追従させる。issue #243
        const withinReveal = Math.abs(dragX) <= actionsWidth;
        const shift = iconOnly && withinReveal ? Math.max(dragX, -CONTENT_SHIFT_CAP) : dragX;
        const reveal = iconOnly && withinReveal ? Math.min(Math.abs(dragX), actionsWidth) : 0;
        return (
          <div
            data-testid="swipe-row-content"
            className="relative"
            style={{
              transform: `translateX(${shift}px)`,
              width: reveal > 0 ? `calc(100% - ${reveal}px)` : undefined,
              transition: dragging
                ? "none"
                : "transform var(--dur-base) var(--ease-out), width var(--dur-base) var(--ease-out)",
            }}
          >
            {children}
          </div>
        );
      })()}
    </div>
  );
}
