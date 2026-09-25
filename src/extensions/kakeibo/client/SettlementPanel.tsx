/** 精算の面。家計簿の画面を共有のグループで絞ったときだけ出す。0072、F-320、F-321、F-322 */
import type { GroupSummary, Me } from "@shared/api-types";
import { useState } from "react";
import { Loading } from "@/app/guards";
import { UserAvatar } from "@/components/parts/Avatars";
import { LoadFailure } from "@/components/parts/Failure";
import { Empty, Panel, PanelRow } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { formatShortDate } from "@/lib/dates";
import { useUndoableDelete } from "@/lib/use-undoable-delete";
import { formatSignedYen, formatYen } from "../shared/format";
import type { KakeiboTransfer } from "./api";
import { useDeleteSettlement, useKakeiboSettlement } from "./api";
import { accountRefLabel, kakeiboPersonName } from "./parts";
import { SettlementSheet } from "./SettlementSheet";

/**
 * 精算の面。0072、F-320
 * @param groups 家計簿に使えるグループ全部。精算のシートで自分の口座を探すのに使う
 * @param group いま絞っている共有のグループ
 */
export function SettlementPanel({ groups, group, me }: { groups: GroupSummary[]; group: GroupSummary; me: Me }) {
  const settlement = useKakeiboSettlement(group.id);
  const deleteSettlement = useDeleteSettlement();
  const [settling, setSettling] = useState<KakeiboTransfer | null>(null);
  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。ほかの一覧の消し方とそろえる。issue #12
  const { pending, remove } = useUndoableDelete("精算した記録を消しました");

  if (settlement.isPending) return <Loading />;
  if (settlement.error || !settlement.data) {
    return <LoadFailure what="精算" error={settlement.error} onRetry={() => void settlement.refetch()} />;
  }
  const { balances, transfers } = settlement.data;
  const settlements = settlement.data.settlements.filter((s) => !pending.has(s.id));

  return (
    <Panel title="精算">
      <div className="flex flex-col">
        {balances.map((b) => (
          <PanelRow key={b.userId}>
            <span className="flex min-w-0 items-center gap-1.5">
              <UserAvatar userId={b.userId} groups={groups} me={me} size={20} />
              <span className="min-w-0 truncate">{kakeiboPersonName(b.userId, group.members, me)}</span>
            </span>
            <span className="font-bold tabular-nums" data-testid={`kakeibo-settlement-net-${b.userId}`}>
              {formatSignedYen(b.net)}
            </span>
          </PanelRow>
        ))}
      </div>

      {transfers.length === 0 ? (
        <Empty>精算はありません。</Empty>
      ) : (
        <ul className="flex flex-col gap-2">
          {transfers.map((t, i) => (
            <li key={`${t.from}-${t.to}-${i}`} className="flex items-center justify-between gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">
                {kakeiboPersonName(t.from, group.members, me)} → {kakeiboPersonName(t.to, group.members, me)}{" "}
                <b className="tabular-nums">{formatYen(t.amount)}</b>
              </span>
              <Button type="button" variant="secondary" size="sm" onClick={() => setSettling(t)}>
                精算した
              </Button>
            </li>
          ))}
        </ul>
      )}

      {settlements.length > 0 && (
        <ul className="flex flex-col">
          {settlements.map((s) => (
            <PanelRow key={s.id}>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="min-w-0 truncate">
                  {kakeiboPersonName(s.fromUser, group.members, me)} → {kakeiboPersonName(s.toUser, group.members, me)}
                </span>
                <span className="text-xs text-ink-2">
                  {formatShortDate(s.date)}
                  {accountRefLabel(s.fromAccount) && ` ・ ${accountRefLabel(s.fromAccount)}`}
                </span>
              </span>
              <span className="flex flex-none items-center gap-2">
                <b className="tabular-nums">{formatYen(s.amount)}</b>
                {s.createdBy === me.user.id && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      remove(s.id, ({ keepalive }) => deleteSettlement.mutateAsync({ id: s.id, keepalive }))
                    }
                  >
                    消す
                  </Button>
                )}
              </span>
            </PanelRow>
          ))}
        </ul>
      )}

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
    </Panel>
  );
}
