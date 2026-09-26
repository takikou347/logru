import type { GroupSummary } from "@shared/api-types";
import { Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { Page, PageBar } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { Panel } from "@/components/parts/Panel";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { Button } from "@/components/ui/button";
import { useRowMotion } from "@/lib/use-row-motion";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "@/modules/calendar/model";
import { takeJustAdded } from "@/modules/calendar/recent-items";
import { formatYen } from "../shared/format";
import { AccountSheet } from "./AccountSheet";
import type { KakeiboAccount } from "./api";
import { useDeleteAccount, useKakeiboAccounts, useKakeiboGroups } from "./api";
import { KAKEIBO_ACCOUNT_KIND_ICONS } from "./parts";

/**
 * グループ内の口座 1 件の行。名前・残高は押すと口座ごとの記録の画面へ移る。右の鉛筆は直す・消すシートを開く。
 * 足した(元に戻した)直後は膨らんで入り、消す途中は縮んで消える。直した直後は短く光る。0044、0048、0085、#226
 */
function AccountRow({
  account,
  isLeaving,
  isEdited,
  onEdit,
}: {
  account: KakeiboAccount;
  isLeaving: boolean;
  isEdited: boolean;
  onEdit: () => void;
}) {
  const Icon = KAKEIBO_ACCOUNT_KIND_ICONS[account.kind];
  // 描いた瞬間に 1 度だけ読む。足した直後の再描画と、それ以外の再描画を見分けるため
  const [entering] = useState(() => takeJustAdded(account.id));
  return (
    <li
      className={cn("flex items-center gap-1 border-line not-first:border-t", entering && "item-enter")}
      data-leaving={isLeaving || undefined}
      data-edited={isEdited || undefined}
    >
      <Link
        to={`/kakeibo/accounts/${account.id}`}
        className="grid min-h-14 min-w-0 flex-1 grid-cols-[32px_1fr_auto] items-center gap-2.5 py-1.5 text-ink no-underline"
      >
        <Icon className="size-4.5 text-ink-2" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 truncate text-[15px] font-medium">{account.name}</span>
          {account.archivedAt && <span className="text-xs text-ink-2">使わない</span>}
        </span>
        <span className="font-bold tabular-nums">{formatYen(account.balance)}</span>
      </Link>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`${account.name} を直す`}
        onClick={onEdit}
        className="flex-none"
      >
        <Pencil className="size-4" />
      </Button>
    </li>
  );
}

/** 1 つのグループの口座の面。自分だけのグループは「自分の口座」、共有のグループはその名前 */
function AccountGroupPanel({
  group,
  accounts,
  leaving,
  flashing,
  onEdit,
}: {
  group: GroupSummary;
  accounts: KakeiboAccount[];
  leaving: Set<string>;
  flashing: Set<string>;
  onEdit: (account: KakeiboAccount) => void;
}) {
  const total = accounts.reduce((n, a) => n + a.balance, 0);
  return (
    <Panel title={group.isPersonal ? "自分の口座" : group.name}>
      <div className="flex items-center justify-between text-sm text-ink-2">
        <span>{group.isPersonal ? "総資産" : "合計"}</span>
        <span className="font-bold text-ink tabular-nums">{formatYen(total)}</span>
      </div>
      <ul className="flex flex-col">
        {accounts.map((a) => (
          <AccountRow
            key={a.id}
            account={a}
            isLeaving={leaving.has(a.id)}
            isEdited={flashing.has(a.id)}
            onEdit={() => onEdit(a)}
          />
        ))}
      </ul>
    </Panel>
  );
}

/**
 * 口座の画面。F-309、F-312、F-313
 * 自分の口座と、グループごとの共有口座を並べる。作る、直す、使わないにする、消す
 */
export function AccountsPage() {
  const me = useMe();
  const { groups, ready } = useKakeiboGroups();
  const accounts = useKakeiboAccounts(null, ready);
  const [params, setParams] = useSearchParams();
  const deleteAccount = useDeleteAccount();
  // 消すときは確認を出さず、5 秒だけ「元に戻す」を出す。縮んで消える動きと、直した行を光らせる印も持つ。#194、0085、#226
  const { hidden, leaving, remove, flashing, flash } = useRowMotion("口座を消しました");

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });
  const editingId = params.get("edit");
  const closeEdit = () => setParams((p) => (p.delete("edit"), p), { replace: true });
  const handleDelete = (account: KakeiboAccount) =>
    remove(account.id, ({ keepalive }) => deleteAccount.mutateAsync({ id: account.id, keepalive }));
  // もう一度押したときも、前のシートが閉じる動きの途中なら新しく開き直す。
  // key に積んで、確実に新しい `AccountSheet` を作る。#211
  const editGen = useRef(0);
  useAppFrame({ poolColors: poolColorsOf(groups, me.data) });

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  const rows = (accounts.data ?? []).filter((a) => !hidden.has(a.id));
  const editing = rows.find((a) => a.id === editingId);
  const byGroup = groups
    .map((g) => ({ group: g, accounts: rows.filter((a) => a.groupId === g.id) }))
    .filter((g) => g.accounts.length > 0);

  return (
    <>
      <Page>
        <PageBar title="家計簿の口座" back="/kakeibo" />

        {accounts.error && !accounts.data && (
          <LoadFailure what="口座" error={accounts.error} onRetry={() => void accounts.refetch()} />
        )}
        {accounts.isPending && <Loading />}

        {accounts.data && byGroup.length === 0 && (
          <Panel>
            <EmptyState
              pose="coin"
              bordered={false}
              action={{
                label: "口座を作る",
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              }}
            >
              まだ口座がありません。現金や銀行など、お金の置き場所ごとに作ります。
            </EmptyState>
          </Panel>
        )}

        {byGroup.map(({ group, accounts: groupAccounts }) => (
          <AccountGroupPanel
            key={group.id}
            group={group}
            accounts={groupAccounts}
            leaving={leaving}
            flashing={flashing}
            onEdit={(a) => {
              editGen.current += 1;
              setParams((p) => (p.set("edit", a.id), p), { replace: true });
            }}
          />
        ))}

        <Dock label="口座の操作">
          <PrimaryAddButton
            label="口座を作る"
            addables={[
              {
                key: "account",
                label: "口座を作る",
                icon: KAKEIBO_ACCOUNT_KIND_ICONS.other,
                onClick: () => setParams((p) => (p.set("create", "1"), p), { replace: true }),
              },
            ]}
          />
        </Dock>
      </Page>
      {creating && <AccountSheet groups={groups} me={data} onClose={closeCreate} />}
      {editing && (
        <AccountSheet
          key={`${editingId}-${editGen.current}`}
          groups={groups}
          me={data}
          account={editing}
          onClose={closeEdit}
          onDelete={handleDelete}
          onSaved={flash}
        />
      )}
    </>
  );
}
