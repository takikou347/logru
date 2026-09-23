import type { HomeForm, HomeWidgetEntry } from "@shared/api-types";
import { HOME_CALENDAR_WIDGET_KEY } from "@shared/home";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HomeWidgetSlot } from "../layout";
import { WidgetFrame } from "./WidgetFrame";

/**
 * ホームのウィジェットの並び。編集の状態では、枠と上へ・下へ・外すのボタンを添える。0029
 * ドラッグでの並べ替えにも対応するが、ボタンでも同じことができる。
 *
 * 大きさは持たない。スマホは 1 列。PC は 2 列に流し、カレンダーの本体だけ幅いっぱいにする。0037
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
      className={cn("grid items-start gap-3", form === "desktop" ? "grid-cols-2" : "grid-cols-1")}
    >
      {slots.map((slot, i) => (
        // biome-ignore lint/a11y/noStaticElementInteractions: ドロップの受け先。持ち手からのドラッグだけが起こす
        <div
          key={slot.entry.key}
          className={cn(form === "desktop" && slot.entry.key === HOME_CALENDAR_WIDGET_KEY && "col-span-2")}
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
              index={i}
              total={slots.length}
              removable={slot.widget.key !== HOME_CALENDAR_WIDGET_KEY}
              dragging={dragIndex === i}
              onMoveUp={() => move(i, i - 1)}
              onMoveDown={() => move(i, i + 1)}
              onRemove={() => onChange(slots.filter((_, j) => j !== i).map((s) => s.entry))}
              onDragStart={(e) => {
                setDragIndex(i);
                e.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => setDragIndex(null)}
            />
          ) : (
            <slot.widget.Component editing={false} />
          )}
        </div>
      ))}
    </div>
  );
}
