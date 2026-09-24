/** 家計簿の画面で使い回す部品 */

import type { GroupMember, GroupSummary, Me } from "@shared/api-types";
import { Banknote, CreditCard, Landmark, type LucideIcon, Smartphone, Wallet } from "lucide-react";
import { Dot } from "@/components/parts/Panel";
import { groupColor } from "@/lib/colors";
import type { KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboAccountRef } from "./api";

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
