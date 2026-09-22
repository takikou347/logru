import type { HomeWidget } from "@extensions/client/types";
import type { HomeWidgetEntry, HomeWidgetSize } from "@shared/api-types";
import { ChevronDown, ChevronUp, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SIZE_LABEL: Record<HomeWidgetSize, string> = { small: "小", medium: "中", large: "大" };

/**
 * 編集の状態で 1 つのウィジェットを包む枠。上へ・下へ、大きさ、外す、を並べる。0029
 * キーボードと読み上げでも操作できるよう、並べ替えはドラッグだけでなくボタンでもできる。
 *
 * @param removable false ならカレンダーの本体。外すボタンを出さない
 */
export function WidgetFrame({
  widget,
  entry,
  index,
  total,
  removable,
  dragging,
  onMoveUp,
  onMoveDown,
  onResize,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  widget: HomeWidget;
  entry: HomeWidgetEntry;
  index: number;
  total: number;
  removable: boolean;
  dragging: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onResize: (size: HomeWidgetSize) => void;
  onRemove: () => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <div
      data-testid="widget-frame"
      data-widget-key={widget.key}
      className={cn(
        "glass flex flex-col gap-2.5 rounded-panel border border-dashed border-(--glass-edge) p-3",
        dragging && "opacity-40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-bold text-ink-2">
          {/* 並べ替えの持ち手。ここだけをドラッグの元にし、枠の中のボタンの押しやすさを保つ */}
          <span
            draggable
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            aria-hidden="true"
            className="cursor-grab touch-none"
          >
            <GripVertical className="size-4 flex-none" />
          </span>
          <span className="truncate">{widget.label}</span>
        </div>
        <div className="flex flex-none items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${widget.label}を上へ`}
            disabled={index === 0}
            onClick={onMoveUp}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-8"
            aria-label={`${widget.label}を下へ`}
            disabled={index === total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="size-4" />
          </Button>
          {removable && (
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-sun"
              aria-label={`${widget.label}を外す`}
              onClick={onRemove}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
      {widget.sizes.length > 1 && (
        <div role="radiogroup" aria-label={`${widget.label}の大きさ`} className="flex gap-1.5">
          {widget.sizes.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={entry.size === s}
              onClick={() => onResize(s)}
              className={cn(
                "min-h-8 flex-1 rounded-full border border-(--glass-edge) text-xs font-bold",
                entry.size === s ? "bg-primary text-primary-foreground" : "bg-field text-ink-2",
              )}
            >
              {SIZE_LABEL[s]}
            </button>
          ))}
        </div>
      )}
      <div className="pointer-events-none opacity-90" inert>
        <widget.Component size={entry.size} editing />
      </div>
    </div>
  );
}
