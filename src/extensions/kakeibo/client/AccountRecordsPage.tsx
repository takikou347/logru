import { ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { useState } from "react";
import { useParams, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/dates";
import { kakeiboCategoryLabel } from "../shared/categories";
import { isMonthKey } from "../shared/dates";
import { formatYen } from "../shared/format";
import { AccountSheet } from "./AccountSheet";
import type { KakeiboAccountRef, KakeiboExpense } from "./api";
import { useKakeiboAccountDetail, useKakeiboGroups } from "./api";
import {
  addMonthsToKey,
  formatMonthLabel,
  KAKEIBO_ACCOUNT_KIND_ICONS,
  monthKeyOf,
  accountRefLabel as sharedAccountRefLabel,
} from "./parts";

/** 相手の口座の表示。見えなければ「〇〇さんの口座」。口座なしのときは「口座なし」 */
function accountRefLabel(ref: KakeiboAccountRef): string {
  return sharedAccountRefLabel(ref) ?? "口座なし";
}

/** この口座から見た金額。出ていけばマイナス、入ってくればプラス */
function signedAmountFor(record: KakeiboExpense, accountId: string): number {
  if (record.type === "income") return record.amount;
  if (record.type === "expense") return -record.amount;
  // 振替。出す元ならマイナス、入れる先ならプラス
  return record.account?.id === accountId ? -record.amount : record.amount;
}

/** 記録の行。振替は相手の口座を、支出・収入はカテゴリを添える */
function RecordRow({ record, accountId }: { record: KakeiboExpense; accountId: string }) {
  const signed = signedAmountFor(record, accountId);
  const relation =
    record.type === "transfer"
      ? record.account?.id === accountId
        ? `→ ${accountRefLabel(record.toAccount)}`
        : `${accountRefLabel(record.account)} →`
      : kakeiboCategoryLabel(record.category);
  return (
    <li className="border-line not-first:border-t">
      <div className="grid min-h-11 grid-cols-[4.75rem_1fr] items-center gap-1 py-1 text-left">
        <time className="text-sm font-medium whitespace-nowrap text-ink-2">{formatShortDate(record.date)}</time>
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="min-w-0 truncate">{relation}</span>
          {record.memo && <span className="min-w-0 truncate text-xs font-normal text-ink-2">{record.memo}</span>}
          <span className="ml-auto flex-none font-bold tabular-nums">{formatYen(signed)}</span>
        </span>
      </div>
    </li>
  );
}

/**
 * 口座ごとの記録の画面。F-317
 * 口座の残高と、月ごとにその口座が関わる記録を見る。振替は出す元・入れる先の両方の口座に出る
 */
export function AccountRecordsPage() {
  const { id } = useParams<{ id: string }>();
  const [params, setParams] = useSearchParams();
  const me = useMe();
  const { groups } = useKakeiboGroups();
  const monthParam = params.get("month");
  const month = monthParam && isMonthKey(monthParam) ? monthParam : monthKeyOf(new Date());
  const detail = useKakeiboAccountDetail(id ?? null, month);
  const [editing, setEditing] = useState(false);
  const setMonth = (key: string) => setParams((p) => (p.set("month", key), p), { replace: true });
  // 口座ごとの色は付けていない画面。0071
  useAppFrame({ poolColors: [] });

  if (!id) return null;
  if (detail.isPending || !me.data) return <Loading />;
  if (detail.error || !detail.data) {
    return (
      <Page>
        <PageBar title="口座" back="/kakeibo/accounts" />
        <LoadFailure what="口座" error={detail.error} onRetry={() => void detail.refetch()} />
      </Page>
    );
  }

  const { account, records } = detail.data;
  const Icon = KAKEIBO_ACCOUNT_KIND_ICONS[account.kind];

  return (
    <>
      <Page>
        <PageBar title={account.name} back="/kakeibo/accounts" />
        <Panel>
          <div className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon className="size-5 flex-none text-ink-2" aria-hidden="true" />
              <span className="flex min-w-0 flex-col">
                <b className="truncate text-[17px]">{account.name}</b>
                {account.archivedAt && <span className="text-xs text-ink-2">使わない</span>}
              </span>
            </span>
            <Button type="button" variant="ghost" size="icon" aria-label="口座を直す" onClick={() => setEditing(true)}>
              <Pencil className="size-4" />
            </Button>
          </div>
          <p className="text-2xl font-extrabold tabular-nums" data-testid="kakeibo-account-balance">
            {formatYen(account.balance)}
          </p>
        </Panel>

        <div className="glass flex items-center justify-between rounded-full px-2 py-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="前の月"
            onClick={() => setMonth(addMonthsToKey(month, -1))}
          >
            <ChevronLeft className="size-5" />
          </Button>
          <span className="text-[15px] font-bold">{formatMonthLabel(month)}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="次の月"
            onClick={() => setMonth(addMonthsToKey(month, 1))}
          >
            <ChevronRight className="size-5" />
          </Button>
        </div>

        <Panel title="記録">
          {records.length === 0 ? (
            <Empty>この月の記録はありません。</Empty>
          ) : (
            <ul className="flex flex-col">
              {records.map((r) => (
                <RecordRow key={r.id} record={r} accountId={account.id} />
              ))}
            </ul>
          )}
        </Panel>
      </Page>
      {editing && <AccountSheet groups={groups} me={me.data} account={account} onClose={() => setEditing(false)} />}
    </>
  );
}
