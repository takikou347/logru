/** 定期の記録の画面。F-325 */
import { Repeat } from "lucide-react";
import { useRef, useState } from "react";
import { useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { Panel } from "@/components/parts/Panel";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { formatShortDate } from "@/lib/dates";
import { useRowMotion } from "@/lib/use-row-motion";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "@/modules/calendar/model";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import { kakeiboCategoryLabel } from "../shared/categories";
import { formatSignedYen, formatYen } from "../shared/format";
import type { KakeiboAccount, KakeiboRecurring, KakeiboRecurringOccurrence } from "./api";
import {
  useDeleteExpense,
  useDeleteRecurring,
  useKakeiboAccounts,
  useKakeiboGroups,
  useKakeiboRecurrings,
} from "./api";
import { formatMonthLabel } from "./parts";
import { RecurringSheet } from "./RecurringSheet";

/** 口座の名前。本人が作った定期の記録だけを読むので、隠す必要はない。見つからなければ「口座なし」。F-328 */
function accountLabel(id: string | null, accounts: KakeiboAccount[]): string {
  return accounts.find((a) => a.id === id)?.name ?? "口座なし";
}

/**
 * 定期の記録 1 件の行。押すと直すシートが開く。足した(元に戻した)直後は膨らんで入り、消す途中は縮んで消える。
 * 直した直後は短く光る。振替は「出す元 → 入れる先」を、記録の一覧の行(KakeiboPage)と同じ形で出す。
 * 0044、0048、0085、#226、F-328
 */
function RecurringListRow({
  recurring,
  groupLabel,
  accounts,
  isLeaving,
  isEdited,
  onClick,
}: {
  recurring: KakeiboRecurring;
  groupLabel: string;
  accounts: KakeiboAccount[];
  isLeaving: boolean;
  isEdited: boolean;
  onClick: () => void;
}) {
  const [entering] = useState(() => takeJustAdded(recurring.id));
  const title =
    recurring.type === "transfer"
      ? `${accountLabel(recurring.accountId, accounts)} → ${accountLabel(recurring.toAccountId, accounts)}`
      : kakeiboCategoryLabel(recurring.category);
  const amount = recurring.type === "income" ? formatSignedYen(recurring.amount) : formatYen(recurring.amount);
  return (
    <li
      className={cn("border-line not-first:border-t", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
      data-edited={isEdited || undefined}
    >
      <button type="button" className="flex w-full items-center justify-between gap-3 py-2 text-left" onClick={onClick}>
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 truncate text-[15px] font-medium">
            {title}
            {recurring.paused && "(止めている)"}
          </span>
          <span className="text-xs text-ink-2">
            毎月{recurring.dayOfMonth}日 ・ {groupLabel}
            {recurring.endMonth
              ? ` ・ ${formatMonthLabel(recurring.startMonth)}〜${formatMonthLabel(recurring.endMonth)}`
              : ""}
          </span>
        </span>
        <span className="flex-none font-bold tabular-nums">{amount}</span>
      </button>
    </li>
  );
}

/** 定期の記録の画面。すべて並べる。作る、直す、止める、消す */
export function RecurringsPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const recurrings = useKakeiboRecurrings();
  // 振替の「出す元 → 入れる先」の名前に使う。本人が使えるグループ全部の口座。F-328
  const accounts = useKakeiboAccounts(null);
  const [params, setParams] = useSearchParams();
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });
  const deleteExpense = useDeleteExpense();
  // 定期の記録を作った直後に、決めた日をもう過ぎていてその場で入った 1 件を、5 秒だけ元に戻せるようにする。
  // 消す操作の型とは逆に、既定は「何もしない(記録を残す)」で、「元に戻す」を押した(onRestore)ときだけ消す。
  // シートは閉じて消えるので、この画面(閉じても残る)側でフックを持つ。#198
  const { remove: removeOccurrence } = useUndoableDelete("記録しました", (id) => {
    void deleteExpense.mutateAsync({ id });
  });
  const deleteRecurring = useDeleteRecurring();
  // 定期の記録そのものを消すときは確認を出さず、5 秒だけ「元に戻す」を出す。縮んで消える動きと、
  // 直した行を光らせる印も持つ。#194、0085、#226
  const { hidden, leaving, remove: removeRecurring, flashing, flash } = useRowMotion("定期の記録を消しました");

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  // 同じ記録をもう一度押したときも、前のシートが閉じる動きの途中なら新しく開き直す。
  // key に積んで、確実に新しい `RecurringSheet` を作る。#211
  const editGen = useRef(0);
  const handleCreated = (occurrence: KakeiboRecurringOccurrence | null) => {
    if (!occurrence) return;
    // 5 秒たっても、画面を離れても、この記録は消さない(そのまま残す)。commitFn は何もしない
    removeOccurrence(occurrence.id, async () => {}, {
      message: `${formatShortDate(occurrence.date)}の分を記録しました`,
    });
  };
  const handleDelete = (recurring: KakeiboRecurring) =>
    removeRecurring(recurring.id, ({ keepalive }) => deleteRecurring.mutateAsync({ id: recurring.id, keepalive }));

  if (!me.data || !ready) return <Loading />;
  const rows = (recurrings.data ?? []).filter((r) => !hidden.has(r.id));
  const editing = rows.find((r) => r.id === editingId);
  const groupLabel = (groupId: string) => {
    const g = groups.find((x) => x.id === groupId);
    return g ? (g.isPersonal ? "自分だけ" : g.name) : "";
  };

  return (
    <>
      <Page>
        <PageBar title="定期の記録" back="/kakeibo" />

        {recurrings.error && !recurrings.data && (
          <LoadFailure what="定期の記録" error={recurrings.error} onRetry={() => void recurrings.refetch()} />
        )}
        {recurrings.isPending && <Loading />}

        {recurrings.data && rows.length === 0 && (
          <Panel>
            <EmptyState
              pose="coin"
              bordered={false}
              action={{
                label: "定期の記録を作る",
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              }}
            >
              まだ定期の記録がありません。毎月の家賃や給料などを決めておくと、自動で記録されます。
            </EmptyState>
          </Panel>
        )}

        {recurrings.data && rows.length > 0 && (
          <Panel>
            <ul className="flex flex-col">
              {rows.map((r) => (
                <RecurringListRow
                  key={r.id}
                  recurring={r}
                  groupLabel={groupLabel(r.groupId)}
                  accounts={accounts.data ?? []}
                  isLeaving={leaving.has(r.id)}
                  isEdited={flashing.has(r.id)}
                  onClick={() => {
                    editGen.current += 1;
                    setParams((p) => (p.set("edit", r.id), p), { replace: true });
                  }}
                />
              ))}
            </ul>
          </Panel>
        )}

        <Dock label="定期の記録の操作">
          <PrimaryAddButton
            label="定期の記録を作る"
            addables={[
              {
                key: "recurring",
                label: "定期の記録を作る",
                icon: Repeat,
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              },
            ]}
          />
        </Dock>
      </Page>
      {creating && <RecurringSheet groups={groups} me={me.data} onClose={closeCreate} onCreated={handleCreated} />}
      {editing && (
        <RecurringSheet
          key={`${editingId}-${editGen.current}`}
          groups={groups}
          me={me.data}
          recurring={editing}
          onClose={closeEdit}
          onCreated={handleCreated}
          onDelete={handleDelete}
          onSaved={flash}
        />
      )}
    </>
  );
}
