import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/parts/Chip";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { defaultShareGroupId } from "@/lib/share-default";
import { KAKEIBO_ACCOUNT_KINDS, type KakeiboAccountKind } from "../shared/accounts";
import type { KakeiboAccount } from "./api";
import { useDeleteAccount, useSaveAccount } from "./api";
import { sanitizeAmountInput } from "./numeric-input";
import { GroupLabel } from "./parts";

/**
 * 口座を作る、直すシート。F-309
 * 持ち主(グループ)は作った後は変えられない。名前は 1 から 30 字、始まりの残高はマイナスも許す
 * @param defaultGroupId 最初に選ぶグループ。無ければ自分だけ
 */
export function AccountSheet({
  groups,
  me,
  account,
  defaultGroupId,
  onClose,
}: {
  groups: GroupSummary[];
  me: Me;
  account?: KakeiboAccount;
  defaultGroupId?: string | null;
  onClose: () => void;
}) {
  const saveAccount = useSaveAccount();
  const deleteAccount = useDeleteAccount();

  const [groupId, setGroupId] = useState(
    account?.groupId ??
      defaultShareGroupId(groups, defaultGroupId, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "kakeibo",
        alwaysOn: false,
      }),
  );
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<KakeiboAccountKind>(account?.kind ?? "cash");
  const [openingBalance, setOpeningBalance] = useState(account ? String(account.openingBalance) : "0");
  const [archived, setArchived] = useState(Boolean(account?.archivedAt));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const balanceValue = Number(openingBalance);
  const canSubmit =
    name.trim().length > 0 &&
    name.trim().length <= 30 &&
    Boolean(groupId) &&
    openingBalance !== "" &&
    Number.isInteger(balanceValue) &&
    balanceValue >= -100_000_000 &&
    balanceValue <= 100_000_000;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (account) {
        await saveAccount.mutateAsync({
          id: account.id,
          body: { name: name.trim(), kind, openingBalance: balanceValue, archived },
        });
        toast("口座を直しました");
      } else {
        await saveAccount.mutateAsync({ body: { groupId, name: name.trim(), kind, openingBalance: balanceValue } });
        toast("口座を作りました");
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!account) return;
    setBusy(true);
    try {
      await deleteAccount.mutateAsync(account.id);
      toast("口座を消しました");
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet title={account ? "口座を直す" : "口座を作る"} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="名前">
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={name}
              maxLength={30}
              placeholder="現金、りそな銀行"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="kakeibo-account-kind-label">
            種類
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-account-kind-label">
            {KAKEIBO_ACCOUNT_KINDS.map((k) => (
              <Chip key={k.key} role="radio" aria-checked={kind === k.key} onClick={() => setKind(k.key)}>
                {k.label}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="始まりの残高" hint="いま入っている額。カードはマイナスも入れられます">
          {(p) => (
            <Input
              {...p}
              type="text"
              inputMode="numeric"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(sanitizeAmountInput(e.target.value, true))}
              className="text-right"
            />
          )}
        </Field>
        {account ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2">持ち主</span>
            <p className="flex min-h-9 items-center text-[15px]">
              <GroupLabel group={groups.find((g) => g.id === account.groupId)} me={me} />
            </p>
          </div>
        ) : (
          <SharePickerRow groups={groups} me={me} value={groupId} onChange={setGroupId} extensionLabel="家計簿" />
        )}
        {account && (
          <Button type="button" variant="secondary" aria-pressed={archived} onClick={() => setArchived((v) => !v)}>
            {archived ? "使う" : "使わない"}にする
          </Button>
        )}
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex justify-between gap-2">
          {account ? (
            confirmDelete ? (
              <Button type="button" variant="danger" disabled={busy} onClick={() => void remove()}>
                {busy ? "消しています" : "本当に消す"}
              </Button>
            ) : (
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
                消す
              </Button>
            )
          ) : (
            <Button type="button" variant="ghost" onClick={onClose}>
              やめる
            </Button>
          )}
          <Button type="submit" disabled={busy || !canSubmit}>
            {busy ? "保存しています" : "保存する"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}
