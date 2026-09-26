/**
 * 「共有」の選ぶ行。設定の行(RowButton)と同じ形で、押すと下から「共有する相手」の一覧が開く。0057
 *
 * グループが多くても崩れないよう、いまの選択は行に 1 つだけ出す。一覧は縦に並べ、色の点、名前、
 * メンバーの小さなアバター、選んでいる行の印を横に並べる。長い名前は「…」で切る。
 * 予定・思い出・記録・家計簿のシートと、共有リストで使う。
 *
 * その拡張をまだ足していないグループは選べないが、薄く並べて理由と行き先を出す。#164
 */
import type { GroupSummary, Me } from "@shared/api-types";
import { Check } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { useGroups } from "@/api/common";
import { UserAvatarStack } from "@/components/parts/Avatars";
import { Dot, FieldMessage, RowButton } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { groupColor } from "@/lib/colors";
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
      {!group.isPersonal && group.members.length > 0 && (
        <UserAvatarStack userIds={group.members.map((m) => m.id)} groups={[group]} me={me} max={4} size={18} />
      )}
      {checked && <Check className="size-4 flex-none text-primary" aria-hidden="true" />}
    </button>
  );
}

/**
 * まだ拡張を足していないグループの行。選べないが薄く並べ、足す場所を示す。#164
 * グループの画面へのリンクを押すと、開いていたシートを閉じてから移る
 */
function UnusableShareRow({
  group,
  me,
  extensionLabel,
  onNavigate,
}: {
  group: GroupSummary;
  me: Me;
  extensionLabel: string;
  onNavigate: () => void;
}) {
  return (
    <div className="flex min-h-12 flex-col justify-center gap-0.5 border-b border-line py-2 text-left opacity-55 last:border-b-0">
      <span className="flex items-center gap-3 text-[15px]">
        <Dot color={groupColor(group, me.colorPrefs)} />
        <span className="min-w-0 flex-1 truncate">{group.name}</span>
      </span>
      <span className="pl-5 text-xs text-ink-2">
        {extensionLabel}を使うには、
        <Link to={`/groups/${group.id}`} className="underline underline-offset-2" onClick={onNavigate}>
          グループの画面で足す
        </Link>
      </span>
    </div>
  );
}

/** 自分だけのグループを、選ぶ一覧の中で呼ぶ言い方。0059、#164 */
const NONE_LABEL_IN_LIST = "共有しない";
/** 自分だけのグループを、選んだ後の帯や行で呼ぶ言い方。0059、#164 */
const NONE_LABEL_CHOSEN = "自分だけ";

/**
 * 「共有」の選ぶ行と、押すと開く「共有する相手」のシート。0057
 *
 * 自分だけのグループの言い方は、選ぶ一覧の中では「共有しない」、選んだ後の帯では「自分だけ」で固定する。
 * 場面で言い方が割れないよう、拡張からは渡せない。0059、#164
 *
 * @param groups 選べるグループ。自分だけのグループを含む。その拡張を足したグループだけを渡す
 * @param value いま選んでいるグループの ID
 * @param onChange 選んだとき。選ぶと同時にシートを閉じる
 * @param disabled 押せなくするとき。作った本人しか共有先を変えられない予定・家計簿の記録など
 * @param disabledReason 押せない理由。行の下に小さく出す。disabled のときだけ意味を持つ
 * @param usualDefault いまの選択が、いつもの共有先から選ばれたものなら true。行に小さく添える。0063、F-40
 * @param extensionLabel 一覧に出す拡張の名前。全部のグループに入っている拡張(予定など)は渡さなくてよい。#164
 */
export function SharePickerRow({
  groups,
  me,
  value,
  onChange,
  disabled = false,
  disabledReason,
  usualDefault = false,
  extensionLabel = "この機能",
}: {
  groups: GroupSummary[];
  me: Me;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledReason?: string;
  usualDefault?: boolean;
  extensionLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const personal = groups.find((g) => g.isPersonal);
  // 「共有しない」は自分だけのグループに置く。0009
  const choices = personal ? [personal, ...groups.filter((g) => g !== personal)] : groups;
  const chosen = choices.find((g) => g.id === value);
  // この拡張を足していないグループ。薄く並べて、足す場所を示す。#164
  const allGroups = useGroups().data ?? [];
  const usableIds = new Set(groups.map((g) => g.id));
  const unusable = allGroups.filter((g) => !g.isPersonal && !usableIds.has(g.id));

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
            <span className="min-w-0 truncate">{chosen.isPersonal ? NONE_LABEL_CHOSEN : chosen.name}</span>
            {usualDefault && <span className="flex-none text-[11px] text-ink-3">(いつもの共有先)</span>}
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
                label={g.isPersonal ? NONE_LABEL_IN_LIST : g.name}
                checked={g.id === value}
                onSelect={() => {
                  onChange(g.id);
                  setOpen(false);
                }}
              />
            ))}
          </div>
          {unusable.length > 0 && (
            <div className="flex flex-col">
              {unusable.map((g) => (
                <UnusableShareRow
                  key={g.id}
                  group={g}
                  me={me}
                  extensionLabel={extensionLabel}
                  onNavigate={() => setOpen(false)}
                />
              ))}
            </div>
          )}
        </ResponsiveSheet>
      )}
    </div>
  );
}
