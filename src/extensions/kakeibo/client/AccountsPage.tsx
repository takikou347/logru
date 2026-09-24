import type { GroupSummary } from "@shared/api-types";
import { Link, useSearchParams } from "react-router";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { Dock } from "@/components/parts/Dock";
import { EmptyState } from "@/components/parts/EmptyState";
import { LoadFailure } from "@/components/parts/Failure";
import { Panel } from "@/components/parts/Panel";
import { PrimaryAddButton } from "@/components/parts/PrimaryAddButton";
import { poolColorsOf } from "@/modules/calendar/model";
import { formatYen } from "../shared/format";
import { AccountSheet } from "./AccountSheet";
import type { KakeiboAccount } from "./api";
import { useKakeiboAccounts, useKakeiboGroups } from "./api";
import { KAKEIBO_ACCOUNT_KIND_ICONS } from "./parts";

/** グループ内の口座 1 件の行。押すと口座ごとの記録の画面へ移る */
function AccountRow({ account }: { account: KakeiboAccount }) {
  const Icon = KAKEIBO_ACCOUNT_KIND_ICONS[account.kind];
  return (
    <li className="border-line not-first:border-t">
      <Link
        to={`/kakeibo/accounts/${account.id}`}
        className="grid min-h-14 grid-cols-[32px_1fr_auto] items-center gap-2.5 py-1.5 text-ink no-underline"
      >
        <Icon className="size-4.5 text-ink-2" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="min-w-0 truncate text-[15px] font-medium">{account.name}</span>
          {account.archivedAt && <span className="text-xs text-ink-2">使わない</span>}
        </span>
        <span className="font-bold tabular-nums">{formatYen(account.balance)}</span>
      </Link>
    </li>
  );
}

/** 1 つのグループの口座の面。自分だけのグループは「自分の口座」、共有のグループはその名前 */
function AccountGroupPanel({ group, accounts }: { group: GroupSummary; accounts: KakeiboAccount[] }) {
  const total = accounts.reduce((n, a) => n + a.balance, 0);
  return (
    <Panel title={group.isPersonal ? "自分の口座" : group.name}>
      <div className="flex items-center justify-between text-sm text-ink-2">
        <span>{group.isPersonal ? "総資産" : "合計"}</span>
        <span className="font-bold text-ink tabular-nums">{formatYen(total)}</span>
      </div>
      <ul className="flex flex-col">
        {accounts.map((a) => (
          <AccountRow key={a.id} account={a} />
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

  const creating = params.get("create") === "1";
  const closeCreate = () => setParams((p) => (p.delete("create"), p), { replace: true });

  if (!me.data || !ready) return <Loading />;
  const data = me.data;
  const rows = accounts.data ?? [];
  const byGroup = groups
    .map((g) => ({ group: g, accounts: rows.filter((a) => a.groupId === g.id) }))
    .filter((g) => g.accounts.length > 0);

  return (
    <AppLayout poolColors={poolColorsOf(groups, data)}>
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
          <AccountGroupPanel key={group.id} group={group} accounts={groupAccounts} />
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
    </AppLayout>
  );
}
