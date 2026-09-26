/** 立て替えの「払った人」「割り方」の欄。記録のシートから使う。0072、F-318、F-319 */
import type { GroupMember, GroupSummary, Me } from "@shared/api-types";
import { useEffect, useState } from "react";
import { UserAvatar } from "@/components/parts/Avatars";
import { Chip } from "@/components/parts/Chip";
import { FieldMessage, RowButton } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Input } from "@/components/ui/input";
import { formatYen } from "../shared/format";
import type { KakeiboSplitMode } from "../shared/splits";
import { sanitizeAmountInput } from "./numeric-input";
import { kakeiboPersonName } from "./parts";

const SPLIT_MODE_LABELS: Record<KakeiboSplitMode, string> = {
  equal: "全員で同じ額",
  custom: "1 人ずつ金額を指定",
  none: "割らない",
};

/** 払った人を選ぶ行。口座と同じ、押すと下から一覧が開く形。0067、F-318 */
export function PayerPickerRow({
  groups,
  members,
  me,
  value,
  onChange,
  disabled,
  disabledReason,
}: {
  groups: GroupSummary[];
  members: GroupMember[];
  me: Me;
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const [open, setOpen] = useState(false);
  const people = [me.user.id, ...members.filter((m) => m.id !== me.user.id).map((m) => m.id)];
  return (
    <div>
      <RowButton type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span>払った人</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-ink-2">
          <UserAvatar userId={value} groups={groups} me={me} size={20} />
          <span className="min-w-0 truncate">{kakeiboPersonName(value, members, me)}</span>
        </span>
      </RowButton>
      {disabled && disabledReason && <FieldMessage>{disabledReason}</FieldMessage>}
      {open && (
        <ResponsiveSheet title="払った人" onClose={() => setOpen(false)}>
          <div role="radiogroup" aria-label="払った人" className="flex flex-col">
            {people.map((id) => (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={value === id}
                onClick={() => {
                  onChange(id);
                  setOpen(false);
                }}
                className="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
              >
                <UserAvatar userId={id} groups={groups} me={me} size={22} />
                <span className="min-w-0 flex-1 truncate">{kakeiboPersonName(id, members, me)}</span>
              </button>
            ))}
          </div>
        </ResponsiveSheet>
      )}
    </div>
  );
}

/**
 * 割り方の欄。全員で同じ額(既定)、1 人ずつ金額を指定、割らないの 3 つ。0072、F-318
 * 1 人ずつのときは、メンバーごとの金額の入力欄を出し、合計が記録の金額と合うまで保存できない。
 *
 * @param amount いまの記録の金額。0 未満は 0 として扱う
 * @param customShares 1 人ずつのときの、人ごとの金額(文字列)。呼び出し側が持つ
 */
export function SplitModeSection({
  groups,
  members,
  me,
  mode,
  onChangeMode,
  amount,
  customShares,
  onChangeCustomShares,
}: {
  groups: GroupSummary[];
  members: GroupMember[];
  me: Me;
  mode: KakeiboSplitMode;
  onChangeMode: (mode: KakeiboSplitMode) => void;
  amount: number;
  customShares: Record<string, string>;
  onChangeCustomShares: (next: Record<string, string>) => void;
}) {
  const peopleIds = [me.user.id, ...members.filter((m) => m.id !== me.user.id).map((m) => m.id)];

  // custom に切り替えた直後、まだ 1 件も入れていなければ、均等割りを初期値にする
  // biome-ignore lint/correctness/useExhaustiveDependencies: 初期値を 1 度だけ作る。以後は手で入れた値を保つので、mode 以外の変化では走らせない
  useEffect(() => {
    if (mode !== "custom") return;
    if (Object.keys(customShares).length > 0) return;
    const n = peopleIds.length || 1;
    const base = Math.floor(Math.max(amount, 0) / n);
    const remainder = Math.max(amount, 0) - base * n;
    const next: Record<string, string> = {};
    peopleIds.forEach((id, i) => {
      next[id] = String(base + (i < remainder ? 1 : 0));
    });
    onChangeCustomShares(next);
  }, [mode]);

  const total = peopleIds.reduce((n, id) => n + (Number(customShares[id]) || 0), 0);

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-ink-2" id="kakeibo-split-mode-label">
        割り方
      </span>
      <div className="flex gap-2" role="radiogroup" aria-labelledby="kakeibo-split-mode-label">
        {(Object.keys(SPLIT_MODE_LABELS) as KakeiboSplitMode[]).map((m) => (
          <Chip key={m} role="radio" aria-checked={mode === m} onClick={() => onChangeMode(m)}>
            {SPLIT_MODE_LABELS[m]}
          </Chip>
        ))}
      </div>
      {mode === "custom" && (
        <div className="flex flex-col">
          {peopleIds.map((id) => {
            const label = kakeiboPersonName(id, members, me);
            return (
              <div
                key={id}
                className="flex min-h-11 items-center justify-between gap-3 border-b border-line last:border-b-0"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <UserAvatar userId={id} groups={groups} me={me} size={20} />
                  <span className="min-w-0 truncate text-sm">{label}</span>
                </span>
                <Input
                  type="text"
                  inputMode="numeric"
                  aria-label={`${label}の負担額`}
                  value={customShares[id] ?? ""}
                  onChange={(e) => onChangeCustomShares({ ...customShares, [id]: sanitizeAmountInput(e.target.value) })}
                  className="w-28 text-right"
                />
              </div>
            );
          })}
          <FieldMessage error={total !== amount}>
            合計 {formatYen(total)}(記録の金額と{total === amount ? "合っています" : "合っていません"})
          </FieldMessage>
        </div>
      )}
    </div>
  );
}
