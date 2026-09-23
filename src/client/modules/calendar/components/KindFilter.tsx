/**
 * 絞り込みの帯の「種類」。予定、思い出、家計簿を入り切りする。0056
 *
 * グループとは違い、種類はどの拡張が何を出しているかによらない、カレンダー本体だけの分け方なので、
 * 出し入れはこの端末の localStorage に持つ。グループの絞り込み(F-20)のように、ほかの端末とは揃えない。
 */
import { Check, SlidersHorizontal } from "lucide-react";
import { useCallback, useState } from "react";
import { sideItemClass } from "@/components/layout/AppLayout";
import { Chip } from "@/components/parts/Chip";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { cn } from "@/lib/utils";
import { KIND_ICONS } from "../kind-icon";
import { type ItemKind, KIND_LABEL, KIND_ORDER } from "../model";

const STORAGE_KEY = "logru-hidden-kinds";

function readHidden(): Set<ItemKind> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return new Set();
    return new Set(raw.filter((k): k is ItemKind => KIND_ORDER.includes(k as ItemKind)));
  } catch {
    return new Set();
  }
}

/** 出さない種類を、この端末に覚えさせる */
export function useHiddenKinds() {
  const [hidden, setHidden] = useState<Set<ItemKind>>(readHidden);
  const toggle = useCallback((kind: ItemKind) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // 覚えられなくても、いまの画面では入り切りできる
      }
      return next;
    });
  }, []);
  return { hidden, toggle };
}

/** 種類ごとの入り切りの行。押すたびに、その種類をカレンダーに出すか出さないかが入れ替わる */
function KindToggles({
  hidden,
  onToggle,
  rowClass,
}: {
  hidden: Set<ItemKind>;
  onToggle: (kind: ItemKind) => void;
  rowClass: string;
}) {
  return KIND_ORDER.map((kind) => {
    const shown = !hidden.has(kind);
    const Icon = KIND_ICONS[kind];
    return (
      <button key={kind} type="button" className={rowClass} aria-pressed={shown} onClick={() => onToggle(kind)}>
        <Icon className={cn("size-4 flex-none", !shown && "text-ink-3")} aria-hidden="true" />
        <span className={cn("min-w-0 flex-1 truncate", !shown && "text-ink-2")}>{KIND_LABEL[kind]}</span>
        <span
          className={cn(
            "grid size-[18px] flex-none place-items-center rounded-[5px] border-[1.5px]",
            shown ? "border-primary bg-primary text-primary-foreground" : "border-ink-3",
          )}
          aria-hidden="true"
        >
          {shown && <Check className="size-3.5" strokeWidth={3} />}
        </span>
      </button>
    );
  });
}

/** PC の左の列に置く、種類の入り切り。グループの絞り込みの下に並べる */
export function SideKinds({ hidden, onToggle }: { hidden: Set<ItemKind>; onToggle: (kind: ItemKind) => void }) {
  return (
    <div role="group" aria-label="表示する種類" className="pr-2">
      <KindToggles hidden={hidden} onToggle={onToggle} rowClass={cn(sideItemClass, "aria-pressed:bg-transparent")} />
    </div>
  );
}

/** スマホの絞り込みの並びに置く「種類」のボタンと、押すと開くシート */
export function KindChip({ hidden, onToggle }: { hidden: Set<ItemKind>; onToggle: (kind: ItemKind) => void }) {
  const [open, setOpen] = useState(false);
  const filtering = hidden.size > 0;
  return (
    <>
      <Chip aria-label="表示する種類" aria-haspopup="dialog" aria-pressed={filtering} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        種類
        {filtering && (
          <span className="text-[12px] tabular-nums">
            {KIND_ORDER.length - hidden.size}/{KIND_ORDER.length}
          </span>
        )}
      </Chip>
      {open && (
        <ResponsiveSheet
          title="表示する種類"
          description="印を外した種類を、自分のカレンダーに出しません。"
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-col">
            <KindToggles
              hidden={hidden}
              onToggle={onToggle}
              rowClass="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
            />
          </div>
        </ResponsiveSheet>
      )}
    </>
  );
}
