import type { HomeForm, HomeWidgetEntry } from "@shared/api-types";
import { HOME_CALENDAR_WIDGET_KEY } from "@shared/home";
import { useMediaQuery } from "@/lib/use-media-query";
import { cn } from "@/lib/utils";
import type { HomeWidgetSlot } from "../layout";
import { usePointerReorder } from "../use-pointer-reorder";
import { WidgetFrame } from "./WidgetFrame";

/**
 * ホームのウィジェットの並び。編集の状態では、枠と上へ・下へ・外すのボタンを添える。0029
 * 並べ替えは持ち手のドラッグ(Pointer Events)でも、上へ・下へのボタンでもできる。#121
 * 動きを減らす設定の端末では、ドラッグは始めず、ボタンだけで並べ替える。
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
  const move = (from: number, to: number) => {
    if (!onChange || to < 0 || to >= slots.length) return;
    const next = slots.map((s) => s.entry);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    onChange(next);
  };

  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const { drag, registerSlot, onHandlePointerDown } = usePointerReorder(
    slots.length,
    !editing || !onChange || reduceMotion,
    move,
  );

  return (
    <div
      data-testid="widget-grid"
      className={cn("grid items-start gap-3", form === "desktop" ? "grid-cols-2" : "grid-cols-1")}
    >
      {slots.map((slot, i) => (
        <div
          key={slot.entry.key}
          ref={registerSlot(i)}
          className={cn(
            form === "desktop" && slot.entry.key === HOME_CALENDAR_WIDGET_KEY && "col-span-2",
            // 指が乗っている先。ここへ入ることを示す印。#121
            drag &&
              drag.overIndex === i &&
              drag.index !== i &&
              "rounded-panel outline-2 outline-dashed outline-primary outline-offset-2",
          )}
        >
          {editing && onChange ? (
            <WidgetFrame
              widget={slot.widget}
              index={i}
              total={slots.length}
              removable={slot.widget.key !== HOME_CALENDAR_WIDGET_KEY}
              dragging={drag?.index === i}
              dragOffset={drag?.index === i ? { x: drag.dx, y: drag.dy } : null}
              onMoveUp={() => move(i, i - 1)}
              onMoveDown={() => move(i, i + 1)}
              onRemove={() => onChange(slots.filter((_, j) => j !== i).map((s) => s.entry))}
              onHandlePointerDown={onHandlePointerDown(i)}
            />
          ) : (
            <slot.widget.Component editing={false} />
          )}
        </div>
      ))}
    </div>
  );
}
