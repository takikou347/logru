/**
 * 「共有」の選ぶ行。設定の行(RowButton)と同じ形で、押すと下から「共有する相手」の一覧が開く。0057
 *
 * グループが多くても崩れないよう、いまの選択は行に 1 つだけ出す。一覧は縦に並べ、色の点、名前、
 * メンバーの小さなアバター、選んでいる行の印を横に並べる。長い名前は「…」で切る。
 * 予定・思い出・記録・家計簿のシートと、共有リストで使う。
 */
import type { GroupSummary, Me } from "@shared/api-types";
import { Check } from "lucide-react";
import { useState } from "react";
import { AvatarStack } from "@/components/parts/Avatars";
import { Dot, FieldMessage, RowButton } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { groupColor, memberColor } from "@/lib/colors";
import { cn } from "@/lib/utils";

/** 一覧の 1 行の見た目。44 px 以上、色の点、名前、メンバーの小さなアバター、選んでいる印 */
function ShareRow({
  group,
  me,
  label,
  checked,
  onSelect,
}: {
  group: GroupSummary;
  me: Me;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  const people = group.members.map((m) => ({
    id: m.id,
    name: m.name,
    color: memberColor(m.id, m.userColor, me.colorPrefs),
    avatarUrl: m.avatarUrl,
  }));
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
    >
      <Dot color={groupColor(group, me.colorPrefs)} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {!group.isPersonal && people.length > 0 && <AvatarStack people={people} max={4} size={18} />}
      {checked && <Check className="size-4 flex-none text-primary" aria-hidden="true" />}
    </button>
  );
}

/**
 * 「共有」の選ぶ行と、押すと開く「共有する相手」のシート。0057
 *
 * @param groups 選べるグループ。自分だけのグループを含む
 * @param value いま選んでいるグループの ID
 * @param onChange 選んだとき。選ぶと同時にシートを閉じる
 * @param disabled 押せなくするとき。写真を足した後は共有先を変えられない(記録のシート)など
 * @param disabledReason 押せない理由。行の下に小さく出す。disabled のときだけ意味を持つ
 * @param noneLabel 自分だけのグループの文言。既定は「共有しない」
 */
export function SharePickerRow({
  groups,
  me,
  value,
  onChange,
  disabled = false,
  disabledReason,
  noneLabel = "共有しない",
}: {
  groups: GroupSummary[];
  me: Me;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  noneLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const personal = groups.find((g) => g.isPersonal);
  // 「共有しない」は自分だけのグループに置く。0009
  const choices = personal ? [personal, ...groups.filter((g) => g !== personal)] : groups;
  const chosen = choices.find((g) => g.id === value);

  return (
    <div>
      <RowButton
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={cn(disabled && "opacity-50")}
      >
        <span>共有</span>
        {chosen && (
          <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-ink-2">
            <Dot color={groupColor(chosen, me.colorPrefs)} />
            <span className="min-w-0 truncate">{chosen.isPersonal ? noneLabel : chosen.name}</span>
          </span>
        )}
      </RowButton>
      {disabled && disabledReason && <FieldMessage>{disabledReason}</FieldMessage>}
      {open && (
        <ResponsiveSheet title="共有する相手" onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="共有する相手" className="flex flex-col">
            {choices.map((g) => (
              <ShareRow
                key={g.id}
                group={g}
                me={me}
                label={g.isPersonal ? noneLabel : g.name}
                checked={g.id === value}
                onSelect={() => {
                  onChange(g.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
        </ResponsiveSheet>
      )}
    </div>
  );
}
