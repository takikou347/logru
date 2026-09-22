import type { HomeForm, HomeWidgetEntry, HomeWidgetSize } from "@shared/api-types";
import { HOME_CALENDAR_WIDGET_KEY } from "@shared/home";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HomeWidgetSlot } from "../layout";
import { WidgetFrame } from "./WidgetFrame";

/** 大きさの、列に対する広さ。PC は 4 列、スマホは 2 列。0028 */
function spanClass(form: HomeForm, size: HomeWidgetSize): string {
  if (form === "desktop") {
    if (size === "small") return "col-span-1";
    if (size === "medium") return "col-span-2";
    return "col-span-4";
  }
  return size === "small" ? "col-span-1" : "col-span-2";
}

/**
 * ホームのウィジェットの並び。編集の状態では、枠と上へ・下へ・大きさ・外すのボタンを添える。0028
 * ドラッグでの並べ替えにも対応するが、ボタンでも同じことができる。
 */
export function WidgetGrid({
  form,
  slots,
  editing,
  onChange,
}: {
  form: HomeForm;
  slots: HomeWidgetSlot[];
  editing: boolean;
  onChange?: (next: HomeWidgetEntry[]) => void;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const move = (from: number, to: number) => {
    if (!onChange || to < 0 || to >= slots.length) return;
    const next = slots.map((s) => s.entry);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  return (
    <div
      data-testid="widget-grid"
      className={cn("grid items-start gap-3", form === "desktop" ? "grid-cols-4" : "grid-cols-2")}
    >
      {slots.map((slot, i) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: ドロップの受け先。持ち手からのドラッグだけが起こす
        <div
          key={slot.entry.key}
          className={spanClass(form, slot.entry.size)}
          onDragOver={editing ? (e) => e.preventDefault() : undefined}
          onDrop={
            editing
              ? (e) => {
                  e.preventDefault();
                  if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
                  setDragIndex(null);
                }
              : undefined
          }
        >
          {editing && onChange ? (
            <WidgetFrame
              widget={slot.widget}
              entry={slot.entry}
              index={i}
              total={slots.length}
              removable={slot.widget.key !== HOME_CALENDAR_WIDGET_KEY}
              dragging={dragIndex === i}
              onMoveUp={() => move(i, i - 1)}
              onMoveDown={() => move(i, i + 1)}
              onResize={(size) => onChange(slots.map((s, j) => (j === i ? { key: s.entry.key, size } : s.entry)))}
              onRemove={() => onChange(slots.filter((_, j) => j !== i).map((s) => s.entry))}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragIndex(null)}
            />
          ) : (
            <slot.widget.Component size={slot.entry.size} editing={false} />
          )}
        </div>
      ))}
    </div>
  );
}
