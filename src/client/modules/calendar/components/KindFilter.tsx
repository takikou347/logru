/**
 * 絞り込みの帯の「種類」。項目を出した拡張ごとに入り切りする。0056
 *
 * 種類は拡張ごとに分ける。名前とアイコンは、拡張の登録(manifest の名前と、画面の側の icon か nav.icon)から取る。
 * カレンダー本体はどの拡張がどんな項目を出すかを知らないまま、key で入り切りするだけで済む。0001、0002
 * どの拡張が出しているかによらず、出し入れはこの端末の localStorage に持つ。
 * グループの絞り込み(F-20)のように、ほかの端末とは揃えない。
 */
import { Check, SlidersHorizontal } from "lucide-react";
import { useCallback, useState } from "react";
import { sideItemClass } from "@/components/layout/AppLayout";
import { Chip } from "@/components/parts/Chip";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { extensionGroups } from "@/lib/extension-visuals";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "logru-hidden-kinds";

/** 出さない拡張の key。登録に無い key(古い値も含む)は読まずに捨てる */
function readHidden(): Set<string> {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as unknown;
    if (!Array.isArray(raw)) return new Set();
    const valid = new Set(extensionGroups().map((g) => g.key));
    return new Set(raw.filter((k): k is string => typeof k === "string" && valid.has(k)));
  } catch {
    return new Set();
  }
}

/** 出さない拡張の項目を、この端末に覚えさせる */
export function useHiddenKinds() {
  const [hidden, setHidden] = useState<Set<string>>(readHidden);
  const toggle = useCallback((key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
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

/** 拡張ごとの入り切りの行。押すたびに、その拡張の項目をカレンダーに出すか出さないかが入れ替わる */
function KindToggles({
  hidden,
  onToggle,
  rowClass,
}: {
  hidden: Set<string>;
  onToggle: (key: string) => void;
  rowClass: string;
}) {
  return extensionGroups().map(({ key, label, icon: Icon }) => {
    const shown = !hidden.has(key);
    return (
      <button key={key} type="button" className={rowClass} aria-pressed={shown} onClick={() => onToggle(key)}>
        <Icon className={cn("size-4 flex-none", !shown && "text-ink-3")} aria-hidden="true" />
        <span className={cn("min-w-0 flex-1 truncate", !shown && "text-ink-2")}>{label}</span>
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
export function SideKinds({ hidden, onToggle }: { hidden: Set<string>; onToggle: (key: string) => void }) {
  return (
    <div role="group" aria-label="表示する種類" className="pr-2">
      <KindToggles hidden={hidden} onToggle={onToggle} rowClass={cn(sideItemClass, "aria-pressed:bg-transparent")} />
    </div>
  );
}

/** スマホの絞り込みの並びに置く「種類」のボタンと、押すと開くシート */
export function KindChip({ hidden, onToggle }: { hidden: Set<string>; onToggle: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const total = extensionGroups().length;
  const filtering = hidden.size > 0;
  return (
    <>
      <Chip aria-label="表示する種類" aria-haspopup="dialog" aria-pressed={filtering} onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" aria-hidden="true" />
        種類
        {filtering && (
          <span className="text-[12px] tabular-nums">
            {total - hidden.size}/{total}
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
