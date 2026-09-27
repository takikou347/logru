/** 「精算した」と記録するシート。0072、F-321 */
import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SheetFooterActions } from "@/components/parts/SheetFooterActions";
import { useSheetSubmit } from "@/components/parts/use-sheet-submit";
import { Input } from "@/components/ui/input";
import { dateKey } from "@/lib/dates";
import { isValidKakeiboAmount } from "../shared/format";
import { useKakeiboAccounts, useSaveSettlement } from "./api";
import { sanitizeAmountInput } from "./numeric-input";
import { AccountPickerRow, kakeiboPersonName } from "./parts";

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

  // 開いているか・送信中か・失敗を、シートの骨組みとしてまとめて持つ。0081
  const { open, busy, error, submit: submitSheet, close, handleClosed } = useSheetSubmit(onClose);
  const [amountText, setAmountText] = useState(String(amount));
  const [date, setDate] = useState(dateKey(new Date()));
  const [fromAccountId, setFromAccountId] = useState<string | null>(null);
  const [toAccountId, setToAccountId] = useState<string | null>(null);

  const amountValue = Number(amountText);
  const amountOk = isValidKakeiboAmount(amountText);
  const canSubmit = Boolean(date) && amountOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitSheet(async () => {
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
    });
  }

  return (
    <ResponsiveSheet
      title="精算した"
      open={open}
      onOpenChange={close}
      onClose={handleClosed}
      footer={<SheetFooterActions formId={SETTLEMENT_FORM_ID} busy={busy} canSubmit={canSubmit} onCancel={close} />}
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
            <AccountPickerRow
              label="自分の口座"
              accounts={myAccounts}
              value={fromUser === me.user.id ? fromAccountId : toAccountId}
              onChange={fromUser === me.user.id ? setFromAccountId : setToAccountId}
              allowNone
            />
            <FieldMessage>口座を選ぶと、その口座の残高が動きます。</FieldMessage>
          </div>
        )}
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
