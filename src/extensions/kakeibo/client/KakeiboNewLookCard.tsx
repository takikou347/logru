/**
 * 家計簿の画面(`/kakeibo`)の、ラボの「新しい見た目」・スマホだけの中身。A3 の kakeibo.png に寄せた。
 *
 * 予算・この月の合計・精算・日ごとの記録を、1 枚の面にまとめる。口座とカテゴリ別の合計は、この面には
 * 出さない(口座はタブから、カテゴリはいまのところ省いた)。古い見た目・PC は KakeiboPage の
 * 元の並び(複数の面)のまま変えない。issue #243
 */
import type { GroupSummary, Me } from "@shared/api-types";
import { useState } from "react";
import { Link } from "react-router";
import { EmptyState } from "@/components/parts/EmptyState";
import { Button } from "@/components/ui/button";
import { groupColor } from "@/lib/colors";
import { dayTone, parseDateKey, WEEKDAYS } from "@/lib/dates";
import { useRowExpandName } from "@/lib/row-expand";
import { cn } from "@/lib/utils";
import { toneText } from "@/modules/calendar/components/DayItems";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import { upcomingOrCurrentBudgets } from "../shared/budgets";
import { kakeiboCategoryLabel } from "../shared/categories";
import { formatSignedYen, formatYen } from "../shared/format";
import type { KakeiboBudget, KakeiboExpense, KakeiboSummary, KakeiboTransfer } from "./api";
import { useKakeiboSettlement } from "./api";
import { BudgetRow } from "./BudgetPanel";
import { accountRefLabel, kakeiboPersonName } from "./parts";
import { SettlementSheet } from "./SettlementSheet";

/** 記録の題名と補足。メモがあればメモを題名にし、カテゴリ(か振替の相手)を補足へ回す。#243 */
function recordTitle(
  record: KakeiboExpense,
  groupLabel: string,
  members: GroupSummary["members"],
  me: Me,
): { title: string; subtitle: string } {
  const categoryOrRelation =
    record.type === "transfer"
      ? `${accountRefLabel(record.account) ?? "口座なし"} → ${accountRefLabel(record.toAccount) ?? "口座なし"}`
      : kakeiboCategoryLabel(record.category);
  const memo = record.memo?.trim();
  const parts: string[] = [];
  if (memo) parts.push(categoryOrRelation);
  if (groupLabel) parts.push(groupLabel);
  if (record.splitMode) parts.push(`${kakeiboPersonName(record.paidBy, members, me)}払い`);
  else if (record.type !== "transfer") {
    const account = accountRefLabel(record.account);
    if (account) parts.push(account);
  }
  return { title: memo || categoryOrRelation, subtitle: parts.join(" · ") };
}

/**
 * 記録 1 行。左に色の細い棒(グループの色。自分だけの記録は薄い線の色)、題名・補足、右に金額。
 * 足す・消すの動き、行がそのままシートに広がる動き(共有要素)は、いまの RecordRow と同じ仕組みを使う。0044、0048、0093
 */
function NewLookRecordRow({
  record,
  groupLabel,
  members,
  me,
  barColor,
  onClick,
  isLeaving,
}: {
  record: KakeiboExpense;
  groupLabel: string;
  members: GroupSummary["members"];
  me: Me;
  barColor: string;
  onClick: () => void;
  isLeaving: boolean;
}) {
  const { title, subtitle } = recordTitle(record, groupLabel, members, me);
  const amount = record.type === "income" ? formatSignedYen(record.amount) : formatYen(record.amount);
  const [entering] = useState(() => takeJustAdded(record.id));
  const viewTransitionName = useRowExpandName(record.id);
  return (
    <li
      className={cn("border-line not-first:border-t", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
      style={viewTransitionName ? { viewTransitionName } : undefined}
    >
      <button
        type="button"
        className="grid min-h-11 w-full grid-cols-[3px_1fr_auto] items-center gap-3 py-1.5 text-left"
        onClick={onClick}
      >
        <span className="h-8 w-[3px] flex-none rounded-full" style={{ background: barColor }} aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span data-title className="min-w-0 truncate text-sm font-medium">
            {title}
          </span>
          {subtitle && <span className="min-w-0 truncate text-xs text-ink-2">{subtitle}</span>}
        </span>
        <span className="flex-none font-bold text-ink tabular-nums">{amount}</span>
      </button>
    </li>
  );
}

/** その日の記録の合計。振替は動かした額であって使った額ではないので、日の合計には入れない */
function dayTotal(records: KakeiboExpense[]): number {
  return records.reduce((n, r) => (r.type === "transfer" ? n : n + r.amount), 0);
}

/** 記録を、もう新しい日付順の並びのまま、同じ日付ごとにまとめる */
function groupByDay(records: KakeiboExpense[]): { date: string; records: KakeiboExpense[] }[] {
  const days: { date: string; records: KakeiboExpense[] }[] = [];
  for (const r of records) {
    const last = days.at(-1);
    if (last && last.date === r.date) last.records.push(r);
    else days.push({ date: r.date, records: [r] });
  }
  return days;
}

/** 日の見出し。日付・曜日(日曜と祝日は朱、土曜は青)と、その日の合計 */
function DayHeader({ date, total }: { date: string; total: number }) {
  const d = parseDateKey(date);
  if (!d) return null;
  const tone = dayTone(d);
  return (
    <div className="flex items-baseline gap-1.5 pt-3 pb-1 first:pt-0">
      <span className={cn("text-[17px] font-medium tabular-nums", tone && toneText[tone])}>{d.getDate()}</span>
      <span className={cn("text-xs text-ink-2", tone && toneText[tone])}>{WEEKDAYS[d.getDay()]}</span>
      <span className="ml-auto text-xs text-ink-2 tabular-nums">{formatYen(total)}</span>
    </div>
  );
}

/**
 * 共有のグループの精算を、1 行(相手 → 相手 金額、「精算する」)で出す。人ごとの差し引きの内訳と、
 * 精算した記録の履歴は、この面には出さない(SettlementPanel が持つ、古い見た目でだけ使う機能)。issue #243
 */
function SettlementRows({ group, me, groups }: { group: GroupSummary; me: Me; groups: GroupSummary[] }) {
  const settlement = useKakeiboSettlement(group.id);
  const [settling, setSettling] = useState<KakeiboTransfer | null>(null);
  const transfers = settlement.data?.transfers ?? [];
  if (transfers.length === 0) return null;
  return (
    <div className="border-t border-line pt-2">
      {transfers.map((t, i) => (
        <div key={`${t.from}-${t.to}-${i}`} className="flex min-h-11 items-center gap-2 text-[13.5px]">
          <i className="size-2 flex-none rounded-full" style={{ background: groupColor(group, me.colorPrefs) }} />
          <span className="min-w-0 truncate">
            {kakeiboPersonName(t.from, group.members, me)} → {kakeiboPersonName(t.to, group.members, me)}{" "}
            <b className="tabular-nums">{formatYen(t.amount)}</b>
          </span>
          <Button type="button" variant="secondary" size="sm" className="ml-auto" onClick={() => setSettling(t)}>
            精算する
          </Button>
        </div>
      ))}
      {settling && (
        <SettlementSheet
          groups={groups}
          group={group}
          me={me}
          fromUser={settling.from}
          toUser={settling.to}
          amount={settling.amount}
          onClose={() => setSettling(null)}
        />
      )}
    </div>
  );
}

/** 「すべて」で絞ったときの、グループをまたいだ精算の一覧。押すとそのグループで絞る */
function AllGroupsSettlementRows({
  settlements,
  groups,
  me,
}: {
  settlements: NonNullable<KakeiboSummary["settlements"]>;
  groups: GroupSummary[];
  me: Me;
}) {
  const rows = settlements.flatMap((gs) =>
    gs.transfers.map((t, i) => ({ ...t, groupId: gs.groupId, key: `${gs.groupId}-${i}` })),
  );
  if (rows.length === 0) return null;
  return (
    <div className="border-t border-line pt-2">
      {rows.map((t) => {
        const g = groups.find((x) => x.id === t.groupId);
        return (
          <Link
            key={t.key}
            to={`/kakeibo?group=${t.groupId}`}
            className="flex min-h-11 items-center gap-2 text-[13.5px] text-ink no-underline"
          >
            {g && <i className="size-2 flex-none rounded-full" style={{ background: groupColor(g, me.colorPrefs) }} />}
            <span className="min-w-0 truncate">
              {g?.name ?? ""} {kakeiboPersonName(t.from, g?.members ?? [], me)} →{" "}
              {kakeiboPersonName(t.to, g?.members ?? [], me)}
            </span>
            <b className="ml-auto flex-none tabular-nums">{formatYen(t.amount)}</b>
          </Link>
        );
      })}
    </div>
  );
}

export function KakeiboNewLookCard({
  data,
  budgets,
  groups,
  group,
  month,
  selectedGroup,
  me,
  today,
  hidden,
  leaving,
  openEdit,
  openRecordSheet,
}: {
  data: KakeiboSummary;
  /** 読み込み中は undefined。届くまで予算の節は出さない */
  budgets: KakeiboBudget[] | undefined;
  groups: GroupSummary[];
  group: string | null;
  /** いま見ている月。`2026-09` の形 */
  month: string;
  selectedGroup: GroupSummary | undefined;
  me: Me;
  today: string;
  hidden: Set<string>;
  leaving: Set<string>;
  openEdit: (id: string) => void;
  openRecordSheet: () => void;
}) {
  const records = data.records.filter((r) => !hidden.has(r.id));
  const pendingRecords = data.records.filter((r) => leaving.has(r.id));
  const totalExpense =
    data.totalExpense - pendingRecords.filter((r) => r.type === "expense").reduce((n, r) => n + r.amount, 0);
  const totalIncome =
    data.totalIncome - pendingRecords.filter((r) => r.type === "income").reduce((n, r) => n + r.amount, 0);
  const shownBudgets = budgets ? upcomingOrCurrentBudgets(budgets, today) : [];
  const days = groupByDay(records);
  const allSettlements = data.settlements ?? [];

  return (
    <div id="kakeibo-settlement" className="glass scroll-mt-24 rounded-[26px] px-4 py-3.5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs text-ink-2">{Number(month.split("-")[1])}月の支出</p>
          <p className="text-[34px] leading-[1.1] font-extrabold tabular-nums" data-testid="kakeibo-total">
            <span className="mr-0.5 text-base font-normal text-ink-2">¥</span>
            {totalExpense.toLocaleString("ja-JP")}
          </p>
        </div>
        <div className="text-right text-xs text-ink-2 tabular-nums">
          <p>
            収入{" "}
            <b className="font-medium text-ink-2" data-testid="kakeibo-income">
              {formatSignedYen(totalIncome)}
            </b>
          </p>
          <p>
            差し引き{" "}
            <b className="font-medium text-ink-2" data-testid="kakeibo-net">
              {formatSignedYen(totalIncome - totalExpense)}
            </b>
          </p>
        </div>
      </div>

      {(data.toShared !== null ||
        data.fromShared !== null ||
        (data.sharedBurden !== null && data.sharedBurden > 0) ||
        (data.debts?.length ?? 0) > 0) && (
        <div className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs text-ink-2">
          {data.toShared !== null && (
            <span className="flex justify-between" data-testid="kakeibo-to-shared">
              <span>共有口座へ入れた額</span>
              <b className="font-medium tabular-nums">{formatYen(data.toShared)}</b>
            </span>
          )}
          {data.fromShared !== null && (
            <span className="flex justify-between" data-testid="kakeibo-from-shared">
              <span>共有口座から受け取った額</span>
              <b className="font-medium tabular-nums">{formatSignedYen(data.fromShared)}</b>
            </span>
          )}
          {data.sharedBurden !== null && data.sharedBurden > 0 && (
            <span className="flex justify-between" data-testid="kakeibo-shared-burden">
              <span>グループで負担した額</span>
              <b className="font-medium tabular-nums">{formatYen(data.sharedBurden)}</b>
            </span>
          )}
          {data.debts?.map((d) => {
            const g = groups.find((x) => x.id === d.groupId);
            const net = d.receivable - d.payable;
            return (
              <Link
                key={d.groupId}
                to={`/kakeibo?group=${d.groupId}`}
                className="flex justify-between text-ink no-underline"
              >
                <span>{g ? `${g.name}の立て替え` : "立て替え"}</span>
                <b className="font-medium tabular-nums" data-testid={`kakeibo-debt-${d.groupId}`}>
                  {net > 0 ? `受け取る ${formatYen(net)}` : `払う ${formatYen(-net)}`}
                </b>
              </Link>
            );
          })}
        </div>
      )}

      {shownBudgets.length > 0 && (
        <div className="border-t border-line pt-2">
          {shownBudgets.map((b) => (
            <BudgetRow key={b.id} budget={b} />
          ))}
        </div>
      )}

      {selectedGroup && !selectedGroup.isPersonal && <SettlementRows group={selectedGroup} me={me} groups={groups} />}
      {!group && allSettlements.length > 0 && (
        <AllGroupsSettlementRows settlements={allSettlements} groups={groups} me={me} />
      )}

      <div className="border-t border-line pt-1">
        {data.recordsTruncated && (
          <p className="pt-2 text-xs text-ink-2" data-testid="kakeibo-records-truncated">
            新しい {records.length} 件を出しています。合計はこの月の全部の記録から計算しています。
          </p>
        )}
        {records.length === 0 ? (
          <EmptyState pose="coin" bordered={false} action={{ label: "支出を記録する", onClick: openRecordSheet }}>
            この月の記録はまだありません。
          </EmptyState>
        ) : (
          days.map(({ date, records: dayRecords }) => (
            <div key={date}>
              <DayHeader date={date} total={dayTotal(dayRecords)} />
              <ul className="flex flex-col">
                {dayRecords.map((r) => {
                  const recordGroup = groups.find((g) => g.id === r.groupId);
                  const groupLabel = recordGroup && !recordGroup.isPersonal ? recordGroup.name : "";
                  // 自分だけの記録は、グループの色の代わりに薄い ink の色にする。A3 の day() の既定の棒と同じ考え
                  const barColor =
                    recordGroup && !recordGroup.isPersonal ? groupColor(recordGroup, me.colorPrefs) : "var(--ink-3)";
                  return (
                    <NewLookRecordRow
                      key={r.id}
                      record={r}
                      groupLabel={groupLabel}
                      members={recordGroup?.members ?? []}
                      me={me}
                      barColor={barColor}
                      isLeaving={leaving.has(r.id)}
                      onClick={() => openEdit(r.id)}
                    />
                  );
                })}
              </ul>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
