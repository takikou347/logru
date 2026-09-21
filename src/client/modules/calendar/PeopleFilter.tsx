import { Check, Users } from "lucide-react";
import { useState } from "react";
import { Chip } from "@/components/Chip";
import { Dot } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { cn } from "@/lib/utils";
import type { Person } from "./model";

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
  onToggle: (person: Person, hidden: boolean) => void;
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

/**
 * スマホの絞り込みの並びに置く「人」のボタンと、押すと開くシート。F-20
 * 出さない人がいる間はボタンを塗り、出している人数を添える。
 */
export function PeopleChip({
  people,
  hidden,
  onToggle,
}: {
  people: Person[];
  hidden: Set<string>;
  onToggle: (person: Person, hidden: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const filtering = hidden.size > 0;
  return (
    <>
      <Chip aria-label="表示する人" aria-haspopup="dialog" aria-pressed={filtering} onClick={() => setOpen(true)}>
        <Users className="size-4" aria-hidden="true" />
        人
        {filtering && (
          <span className="text-[12px] tabular-nums">
            {people.length - hidden.size}/{people.length}
          </span>
        )}
      </Chip>
      {open && (
        <ResponsiveSheet
          title="表示する人"
          description="印を外した人が作った予定を、自分のカレンダーに出しません。ほかの人の画面は変わりません。"
          onClose={() => setOpen(false)}
        >
          <div role="group" aria-label="表示する人" className="flex flex-col">
            <PersonToggles
              people={people}
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
