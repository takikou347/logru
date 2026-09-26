/** 「精算した」と記録するシート。0072、F-321 */
import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/parts/Chip";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateKey } from "@/lib/dates";
import { useKakeiboAccounts, useSaveSettlement } from "./api";
import { sanitizeAmountInput } from "./numeric-input";
import { kakeiboPersonName } from "./parts";

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const SETTLEMENT_FORM_ID = "kakeibo-settlement-form";

/**
 * 精算したと記録するシート。金額と日付(既定は今日)、送った人と受け取った人がそれぞれ自分の口座を選べる。
 * 自分の口座は、送った人か受け取った人が自分のときだけ選べる。ほかの人の口座は見えないため。0072
 */
export function SettlementSheet({
  groups,
  group,
  me,
  fromUser,
  toUser,
  amount,
  onClose,
}: {
  /** 家計簿に使えるグループ全部。自分だけのグループ(自分の口座)を探すのに使う */
  groups: GroupSummary[];
  group: GroupSummary;
  me: Me;
  fromUser: string;
  toUser: string;
  amount: number;
  onClose: () => void;
}) {
  const saveSettlement = useSaveSettlement();
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  // 自分の口座だけを選べる。送った人・受け取った人のどちらかが自分のときだけ問い合わせる
  const isMine = fromUser === me.user.id || toUser === me.user.id;
  const personalAccounts = useKakeiboAccounts(isMine ? personalGroupId : null, isMine && Boolean(personalGroupId));
  const myAccounts = personalAccounts.data ?? [];

  // 開いているか。閉じる動きは ResponsiveSheet に任せ、終わってから onClose を呼ぶ。#192
  const [open, setOpen] = useState(true);
  const [amountText, setAmountText] = useState(String(amount));
  const [date, setDate] = useState(dateKey(new Date()));
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amountValue = Number(amountText);
  const amountOk = amountText !== "" && Number.isInteger(amountValue) && amountValue > 0 && amountValue <= 100_000_000;
  const canSubmit = Boolean(date) && amountOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await saveSettlement.mutateAsync({
        groupId: group.id,
        fromUser,
        toUser,
        amount: amountValue,
        date,
        fromAccountId: fromUser === me.user.id ? fromAccountId : undefined,
        toAccountId: toUser === me.user.id ? toAccountId : undefined,
      });
      toast("精算しました");
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      title="精算した"
      open={open}
      onOpenChange={() => setOpen(false)}
      onClose={onClose}
      footer={
        <div className="flex justify-between gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
            やめる
          </Button>
          <Button type="submit" form={SETTLEMENT_FORM_ID} disabled={busy || !canSubmit}>
            {busy ? "保存しています" : "保存する"}
          </Button>
        </div>
      }
    >
      <form id={SETTLEMENT_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <p className="text-sm text-ink-2">
          {kakeiboPersonName(fromUser, group.members, me)} から {kakeiboPersonName(toUser, group.members, me)} へ
        </p>
        <Field label="金額">
          {(p) => (
            <Input
              {...p}
              autoFocus
              type="text"
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
              className="text-right text-xl font-bold"
            />
          )}
        </Field>
        <Field label="日付">
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        {(fromUser === me.user.id || toUser === me.user.id) && myAccounts.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2" id="kakeibo-settlement-account-label">
              自分の口座
            </span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-settlement-account-label">
              <Chip
                role="radio"
                aria-checked={(fromUser === me.user.id ? fromAccountId : toAccountId) === null}
                onClick={() => (fromUser === me.user.id ? setFromAccountId(null) : setToAccountId(null))}
              >
                口座なし
              </Chip>
              {myAccounts.map((a) => (
                <Chip
                  key={a.id}
                  role="radio"
                  aria-checked={(fromUser === me.user.id ? fromAccountId : toAccountId) === a.id}
                  onClick={() => (fromUser === me.user.id ? setFromAccountId(a.id) : setToAccountId(a.id))}
                >
                  {a.name}
                </Chip>
              ))}
            </div>
            <FieldMessage>口座を選ぶと、その口座の残高が動きます。</FieldMessage>
          </div>
        )}
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
