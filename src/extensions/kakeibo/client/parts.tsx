/** 家計簿の画面で使い回す部品 */

import type { GroupSummary, Me } from "@shared/api-types";
import { Banknote, CreditCard, Landmark, type LucideIcon, Smartphone, Wallet } from "lucide-react";
import { Dot } from "@/components/parts/Panel";
import { groupColor } from "@/lib/colors";
import type { KakeiboAccountKind } from "../shared/accounts";

export { formatShortDate } from "@/lib/dates";

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
