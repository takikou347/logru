/** 予算の行と帯。家計簿の画面の上と、予算の画面の両方で使う。0072、F-323、F-324 */
import { formatShortDate } from "@/lib/dates";
import { formatYen } from "../shared/format";
import type { KakeiboBudget } from "./api";

/** 使った割合(0〜100 を超えることもある)を、超えたかどうかとともに出す帯 */
function BudgetBar({ amount, used }: { amount: number; used: number }) {
  const ratio = amount > 0 ? (used / amount) * 100 : 0;
  const over = used > amount;
  return (
    <div
      className="h-2 w-full overflow-hidden rounded-full bg-line"
      role="progressbar"
      aria-valuenow={Math.round(Math.min(ratio, 100))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={`h-full rounded-full ${over ? "bg-sun" : "bg-primary"}`}
        style={{ width: `${Math.min(Math.max(ratio, 0), 100)}%` }}
      />
    </div>
  );
}

/** 予算 1 件の行。名前、期間、予算・使った額・残りと帯 */
export function BudgetRow({ budget, groupLabel }: { budget: KakeiboBudget; groupLabel?: string }) {
  const remaining = budget.amount - budget.used;
  const over = remaining < 0;
  return (
    <div className="flex flex-col gap-1.5 border-line py-2 not-first:border-t">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 truncate text-[15px] font-medium">{budget.name}</span>
          <span className="text-xs text-ink-2">
            {formatShortDate(budget.startDate)}〜{formatShortDate(budget.endDate)}
            {groupLabel && ` ・ ${groupLabel}`}
          </span>
        </span>
        <span className={`flex-none text-xs font-medium ${over ? "text-sun" : "text-ink-2"}`}>
          残り {formatYen(remaining)}
        </span>
      </div>
      <BudgetBar amount={budget.amount} used={budget.used} />
      <div className="flex items-center justify-between text-xs text-ink-2">
        <span>使った額 {formatYen(budget.used)}</span>
        <span>予算 {formatYen(budget.amount)}</span>
      </div>
    </div>
  );
}
