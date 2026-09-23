import type { HomeWidget } from "@extensions/client/types";
import { ArrowDown, ArrowUp, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * 編集の状態で 1 つのウィジェットを包む枠。持ち手、上へ・下へ、外す、を並べる。0029、#76
 * 並べ替えが主な操作なので、上へ・下へは押せる範囲 44px の目に見えるボタンにする。
 * キーボードと読み上げでも操作できるよう、並べ替えはドラッグだけでなくボタンでもできる。
 *
 * @param removable false ならカレンダーの本体。外すボタンを出さない
 */
export function WidgetFrame({
  widget,
  index,
  total,
  removable,
  dragging,
  onMoveUp,
  onMoveDown,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  widget: HomeWidget;
  index: number;
  total: number;
  removable: boolean;
  dragging: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-testid="widget-frame"
      data-widget-key={widget.key}
      className={cn(
        "glass flex flex-col gap-2.5 rounded-panel border border-dashed border-(--glass-edge) p-2.5",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center gap-2">
        {/* 並べ替えの持ち手。ここだけをドラッグの元にし、枠の中のボタンの押しやすさを保つ */}
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          aria-hidden="true"
          className="flex size-11 flex-none cursor-grab touch-none items-center justify-center rounded-xl bg-field text-ink-2"
        >
          <GripVertical className="size-5" />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-bold">{widget.label}</span>
        <div className="flex flex-none items-center gap-1.5">
          <Button
            variant="secondary"
            size="icon"
            className="text-ink"
            aria-label={`${widget.label}を上へ`}
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ArrowUp className="size-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="text-ink"
            aria-label={`${widget.label}を下へ`}
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ArrowDown className="size-5" />
          </Button>
          {removable && (
            <Button
              variant="ghost"
              size="icon"
              className="text-sun"
              aria-label={`${widget.label}を外す`}
              onClick={onRemove}
            >
              <X className="size-5" />
            </Button>
          )}
        </div>
      </div>
      <div className="pointer-events-none opacity-90" inert>
        <widget.Component editing />
      </div>
    </div>
  );
}
