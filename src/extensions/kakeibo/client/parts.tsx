/** 家計簿の画面で使い回す部品 */

import type { GroupMember, GroupSummary, Me } from "@shared/api-types";
import { Banknote, CreditCard, Landmark, type LucideIcon, Smartphone, Wallet } from "lucide-react";
import { useState } from "react";
import { EmptyState } from "@/components/parts/EmptyState";
import { Dot } from "@/components/parts/Panel";
import { PickerOptionRow, PickerRow } from "@/components/parts/PickerRow";
import { groupColor } from "@/lib/colors";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboAccount, KakeiboAccountRef } from "./api";

/**
 * 月を `2026-09` の形にする。画面は端末の時間帯で月を選ぶ。
 * @param d 月の中の 1 日
 */
export function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** `2026-09` の形を、月の初日の Date にする */
function parseMonthKey(key: string): Date {
  const [y, m] = key.split("-").map(Number) as [number, number];
  return new Date(y, m - 1, 1);
}

/** n か月後の月。月の初日を返す */
export function addMonthsToKey(key: string, n: number): string {
  const d = parseMonthKey(key);
  return monthKeyOf(new Date(d.getFullYear(), d.getMonth() + n, 1));
}

/** `2026年9月` の形の見出し */
export function formatMonthLabel(key: string): string {
  const d = parseMonthKey(key);
  return `${d.getFullYear()}年${d.getMonth() + 1}月`;
}

/** 口座の種類ごとのアイコン */
export const KAKEIBO_ACCOUNT_KIND_ICONS: Record<KakeiboAccountKind, LucideIcon> = {
  cash: Banknote,
  bank: Landmark,
  card: CreditCard,
  emoney: Smartphone,
  other: Wallet,
};

/**
 * 立て替え・精算の人の表示名。自分は「自分」、ほかの人はそのグループでの表示名。
 * 見つからなければ「退会した人」。0072、F-318、F-320
 */
export function kakeiboPersonName(userId: string | null, members: GroupMember[], me: Me): string {
  if (userId === null) return "退会した人";
  if (userId === me.user.id) return "自分";
  return members.find((m) => m.id === userId)?.name ?? "退会した人";
}

/** 相手の口座の表示。見えなければ「〇〇さんの口座」。記録・振替・精算の行で使う。0069、0072 */
export function accountRefLabel(ref: KakeiboAccountRef): string | null {
  if (!ref) return null;
  if ("hidden" in ref) return `${ref.ownerName}さんの口座`;
  return ref.name;
}

/**
 * グループの名前と色の点。自分だけのグループは「自分だけ」。思い出やリストのカードと同じ形。#164
 */
export function GroupLabel({ group, me }: { group: GroupSummary | undefined; me: Me }) {
  if (!group) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
      <Dot color={groupColor(group, me.colorPrefs)} />
      <span className="truncate">{group.isPersonal ? "自分だけ" : group.name}</span>
    </span>
  );
}

/**
 * 口座を選ぶ行。支出・収入の「口座」、振替の「出す元」「入れる先」、定期の記録・精算の口座で使う。
 * 押すと下から一覧が開き、選んでいる口座に印が付く。0067、0072、F-309、F-319、#194
 *
 * 「使わない」にした口座は、いま選んでいるものでなければ一覧に出さない。F-309
 */
export function AccountPickerRow({
  label,
  accounts,
  value,
  onChange,
  allowNone,
  excludeId,
  disabled,
  recordGroupId,
}: {
  label: string;
  accounts: KakeiboAccount[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone: boolean;
  excludeId?: string | null;
  disabled?: boolean;
  /**
   * 記録するグループ。渡すと、そのグループ以外の口座(立て替えで選べる自分の口座)に
   * 「自分の口座」と添える。0072、F-319
   */
  recordGroupId?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const options = accounts.filter((a) => (!a.archivedAt || a.id === value) && a.id !== excludeId);
  const chosen = options.find((a) => a.id === value);
  const isOwn = (a: KakeiboAccount) => Boolean(recordGroupId) && a.groupId !== recordGroupId;
  return (
    <PickerRow
      label={label}
      disabled={disabled}
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      valueNode={
        <>
          <span className="min-w-0 truncate">{chosen ? chosen.name : "口座なし"}</span>
          {chosen && isOwn(chosen) && <span className="flex-none text-[11px] text-ink-3">(自分の口座)</span>}
        </>
      }
    >
      {options.length === 0 ? (
        <EmptyState pose="coin" bordered={false} action={{ label: "口座を作る", to: "/kakeibo/accounts" }}>
          まだ口座がありません。作ると、ここで選べます。
        </EmptyState>
      ) : (
        <>
          {allowNone && (
            <PickerOptionRow
              checked={value === null}
              onSelect={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              <span className="min-w-0 flex-1 truncate text-ink-2">口座なし</span>
            </PickerOptionRow>
          )}
          {options.map((a) => {
            const Icon = KAKEIBO_ACCOUNT_KIND_ICONS[a.kind];
            return (
              <PickerOptionRow
                key={a.id}
                checked={value === a.id}
                onSelect={() => {
                  onChange(a.id);
                  setOpen(false);
                }}
              >
                <Icon className="size-4 flex-none text-ink-2" aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{a.name}</span>
                {isOwn(a) && <span className="flex-none text-[11px] text-ink-3">自分の口座</span>}
              </PickerOptionRow>
            );
          })}
        </>
      )}
    </PickerRow>
  );
}
