import { Check, ChevronDown, Users } from "lucide-react";
import { type ReactNode, useCallback, useState } from "react";
import { sideItemClass } from "@/components/AppLayout";
import { Chip } from "@/components/Chip";
import { Dot } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { GroupPeople, Person } from "./model";

type Toggle = (person: Person, hidden: boolean) => void;

/**
 * グループの開け閉めを、端末に覚えさせる。覚えていないグループは fallback にする。
 * @param key localStorage の名前。PC の左の列とスマホのシートで分ける
 * @param fallback 覚えていないグループを開いておくか
 */
export function useOpenGroups(key: string, fallback: boolean) {
  const [stored, setStored] = useState<Record<string, boolean>>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(key) ?? "null") as Record<string, boolean> | null;
      return v && typeof v === "object" ? v : {};
    } catch {
      return {};
    }
  });
  const isOpen = useCallback((groupId: string) => stored[groupId] ?? fallback, [stored, fallback]);
  const setOpen = useCallback(
    (groupId: string, open: boolean) => {
      setStored((prev) => {
        const next = { ...prev, [groupId]: open };
        try {
          localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // 覚えられなくても、いまの画面では開け閉めできる
        }
        return next;
      });
    },
    [key],
  );
  return { isOpen, setOpen };
}

/**
 * 人ごとの切り替えの行。押すと、その人が作った予定を出すか出さないかが入れ替わる。F-20
 * 出している間は aria-pressed を true にし、右の四角に印を付ける。
 *
 * @param rowClass 行の見た目。PC の左の列と、スマホのシートで変える
 */
export function PersonToggles({
  people,
  hidden,
  onToggle,
  rowClass,
}: {
  people: Person[];
  hidden: Set<string>;
  onToggle: Toggle;
  rowClass: string;
}) {
  return people.map((p) => {
    const shown = !hidden.has(p.id);
    return (
      <button key={p.id} type="button" className={rowClass} aria-pressed={shown} onClick={() => onToggle(p, shown)}>
        <Dot color={p.color} className={cn(!shown && "opacity-50")} />
        <span className={cn("min-w-0 flex-1 truncate", !shown && "text-ink-2")}>{p.isMe ? "自分" : p.name}</span>
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

/** 開け閉めの矢印。開いている間は上を向く */
function Chevron() {
  return (
    <ChevronDown
      className="size-4 text-ink-2 transition-transform group-data-[state=open]/section:rotate-180 motion-reduce:transition-none"
      aria-hidden="true"
    />
  );
}

/**
 * PC の左の列の、共有のグループの 1 行。名前を押すとそのグループで絞り、右の矢印でメンバーを開け閉めする。F-20
 *
 * @param pressed そのグループで絞っているか
 * @param onFilter 名前を押したとき
 * @param label 名前の前の色の点と名前
 */
export function SideGroup({
  section,
  label,
  pressed,
  onFilter,
  open,
  onOpenChange,
  hidden,
  onToggle,
}: {
  section: GroupPeople;
  label: ReactNode;
  pressed: boolean;
  onFilter: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hidden: Set<string>;
  onToggle: Toggle;
}) {
  const name = section.group.name;
  return (
    <Collapsible open={open} onOpenChange={onOpenChange} className="group/section">
      <div className="flex items-center gap-0.5">
        <button type="button" className={cn(sideItemClass, "min-w-0 flex-1")} aria-pressed={pressed} onClick={onFilter}>
          {label}
        </button>
        <CollapsibleTrigger asChild>
          <button type="button" className="grid size-[42px] flex-none place-items-center rounded-xl hover:bg-field" aria-label={`${name} のメンバー`}>
            <Chevron />
          </button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent>
        <div role="group" aria-label={`${name} のメンバー`} className="flex flex-col pl-4">
          <PersonToggles
            people={section.people}
            hidden={hidden}
            onToggle={onToggle}
            rowClass={cn(sideItemClass, "min-h-[38px] text-[13px] aria-pressed:bg-transparent")}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/**
 * スマホの絞り込みの並びに置く「人」のボタンと、押すと開くシート。F-20
 * シートは PC の左の列と同じく、グループごとに開け閉めできるまとまりでメンバーを並べる。
 * 出さない人がいる間はボタンを塗り、出している人数を添える。
 *
 * @param total 重ねずに数えた人数
 */
export function PeopleChip({
  sections,
  total,
  hidden,
  onToggle,
}: {
  sections: GroupPeople[];
  total: number;
  hidden: Set<string>;
  onToggle: Toggle;
}) {
  const [open, setOpen] = useState(false);
  const groups = useOpenGroups("logru-sheet-groups", true);
  const filtering = hidden.size > 0;
  return (
    <>
      <Chip aria-label="表示する人" aria-haspopup="dialog" aria-pressed={filtering} onClick={() => setOpen(true)}>
        <Users className="size-4" aria-hidden="true" />
        人
        {filtering && (
          <span className="text-[12px] tabular-nums">
            {total - hidden.size}/{total}
          </span>
        )}
      </Chip>
      {open && (
        <ResponsiveSheet
          title="表示する人"
          description="印を外した人が作った予定を、自分のカレンダーに出しません。ほかの人の画面は変わりません。"
          onClose={() => setOpen(false)}
        >
          <div className="flex flex-col gap-1">
            {sections.map((s) => (
              <Collapsible
                key={s.group.id}
                open={groups.isOpen(s.group.id)}
                onOpenChange={(o) => groups.setOpen(s.group.id, o)}
                className="group/section"
              >
                <CollapsibleTrigger className="flex min-h-11 w-full items-center gap-2 text-left text-[13px] font-bold text-ink-2">
                  <span className="min-w-0 flex-1 truncate">{s.group.name}</span>
                  <Chevron />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div role="group" aria-label={`${s.group.name} のメンバー`} className="flex flex-col">
                    <PersonToggles
                      people={s.people}
                      hidden={hidden}
                      onToggle={onToggle}
                      rowClass="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
                    />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </ResponsiveSheet>
      )}
    </>
  );
}
