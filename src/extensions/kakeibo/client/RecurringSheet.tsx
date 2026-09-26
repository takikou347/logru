/** 定期の記録を作る、直すシート。F-325 */
import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/parts/Chip";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { defaultShareGroupId } from "@/lib/share-default";
import { KAKEIBO_EXPENSE_CATEGORIES, KAKEIBO_INCOME_CATEGORIES, type KakeiboCategory } from "../shared/categories";
import type { KakeiboRecurring, KakeiboRecurringOccurrence } from "./api";
import { useDeleteRecurring, useKakeiboAccounts, useSaveRecurring } from "./api";
import { sanitizeAmountInput } from "./numeric-input";
import { monthKeyOf } from "./parts";

const TYPE_LABELS: Record<"expense" | "income", string> = { expense: "支出", income: "収入" };

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const RECURRING_FORM_ID = "kakeibo-recurring-form";

/**
 * 定期の記録を作る、直すシート。種類、金額、カテゴリ、口座、メモ、グループ、毎月の日、始まりの月、
 * 終わりの月(省ける)を入れる。振替はまだ扱わない。F-325
 */
export function RecurringSheet({
  groups,
  me,
  recurring,
  onClose,
  onCreated,
}: {
  groups: GroupSummary[];
  me: Me;
  recurring?: KakeiboRecurring;
  onClose: () => void;
  /**
   * 作ったときに呼ぶ。決めた日をもう過ぎていて、その場で今月の分を入れたときは occurrence が入る。
   * 呼び出し側(RecurringsPage)が、閉じても消えない「元に戻す」を出す。#198
   */
  onCreated: (occurrence: KakeiboRecurringOccurrence | null) => void;
}) {
  const saveRecurring = useSaveRecurring();
  const deleteRecurring = useDeleteRecurring();
  // 開いているか。閉じる動きは ResponsiveSheet に任せ、終わってから onClose を呼ぶ。#192
  const [open, setOpen] = useState(true);

  const [groupId, setGroupId] = useState(
    recurring?.groupId ??
      defaultShareGroupId(groups, null, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "kakeibo",
        alwaysOn: false,
      }),
  );
  const [type, setType] = useState<"expense" | "income">(recurring?.type === "income" ? "income" : "expense");
  const [amountText, setAmountText] = useState(recurring ? String(recurring.amount) : "");
  const [category, setCategory] = useState<KakeiboCategory | null>(recurring?.category ?? null);
  const [accountId, setAccountId] = useState<string | null>(recurring?.accountId ?? null);
  const [memo, setMemo] = useState(recurring?.memo ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(recurring ? String(recurring.dayOfMonth) : String(new Date().getDate()));
  const [startMonth, setStartMonth] = useState(recurring?.startMonth ?? monthKeyOf(new Date()));
  const [endMonth, setEndMonth] = useState(recurring?.endMonth ?? "");
  const [paused, setPaused] = useState(Boolean(recurring?.paused));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  // 共有のグループなら、そのグループの口座と自分の口座の両方から選べる。0069、F-319
  const accounts = useKakeiboAccounts(selectedGroup?.isPersonal ? groupId : null, Boolean(selectedGroup?.isPersonal));
  const sharedAccounts = useKakeiboAccounts(
    selectedGroup && !selectedGroup.isPersonal ? groupId : null,
    Boolean(selectedGroup) && !selectedGroup?.isPersonal,
  );
  const personalAccounts = useKakeiboAccounts(
    selectedGroup && !selectedGroup.isPersonal ? personalGroupId : null,
    Boolean(selectedGroup) && !selectedGroup?.isPersonal && Boolean(personalGroupId),
  );
  const accountOptions = selectedGroup?.isPersonal
    ? (accounts.data ?? [])
    : [...(sharedAccounts.data ?? []), ...(personalAccounts.data ?? [])];

  const categories = type === "income" ? KAKEIBO_INCOME_CATEGORIES : KAKEIBO_EXPENSE_CATEGORIES;
  const amountValue = Number(amountText);
  const dayValue = Number(dayOfMonth);
  const amountOk = amountText !== "" && Number.isInteger(amountValue) && amountValue > 0 && amountValue <= 100_000_000;
  const canSubmit =
    Boolean(groupId) &&
    Boolean(category) &&
    amountOk &&
    Number.isInteger(dayValue) &&
    dayValue >= 1 &&
    dayValue <= 31 &&
    /^\d{4}-\d{2}$/.test(startMonth) &&
    (endMonth === "" || endMonth >= startMonth);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit || !category) return;
    setBusy(true);
    try {
      if (recurring) {
        await saveRecurring.mutateAsync({
          id: recurring.id,
          body: {
            type,
            amount: amountValue,
            category,
            accountId,
            memo: memo || null,
            dayOfMonth: dayValue,
            startMonth,
            endMonth: endMonth || null,
            paused,
          },
        });
        toast("定期の記録を直しました");
      } else {
        const created = await saveRecurring.mutateAsync({
          body: {
            groupId,
            type,
            amount: amountValue,
            category,
            accountId,
            memo: memo || null,
            dayOfMonth: dayValue,
            startMonth,
            endMonth: endMonth || null,
          },
        });
        if (created.occurrence) {
          onCreated(created.occurrence);
        } else {
          toast("定期の記録を作りました");
        }
      }
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!recurring) return;
    setBusy(true);
    try {
      await deleteRecurring.mutateAsync(recurring.id);
      toast("定期の記録を消しました");
      setOpen(false);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet
      title={recurring ? "定期の記録を直す" : "定期の記録を作る"}
      open={open}
      onOpenChange={() => setOpen(false)}
      onClose={onClose}
      footer={
        <div className="flex justify-between gap-2">
          {recurring ? (
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
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              やめる
            </Button>
          )}
          <Button type="submit" form={RECURRING_FORM_ID} disabled={busy || !canSubmit}>
            {busy ? "保存しています" : "保存する"}
          </Button>
        </div>
      }
    >
      <form id={RECURRING_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        {!recurring && (
          <SharePickerRow groups={groups} me={me} value={groupId} onChange={setGroupId} extensionLabel="家計簿" />
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="kakeibo-recurring-type-label">
            種類
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-recurring-type-label">
            {(["expense", "income"] as const).map((t) => (
              <Chip
                key={t}
                role="radio"
                aria-checked={type === t}
                onClick={() => {
                  setType(t);
                  setCategory(null);
                }}
              >
                {TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="金額">
          {(p) => (
            <Input
              {...p}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={amountText}
              onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
              className="text-right"
            />
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="kakeibo-recurring-category-label">
            カテゴリ
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-recurring-category-label">
            {categories.map((c) => (
              <Chip key={c.key} role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)}>
                {c.label}
              </Chip>
            ))}
          </div>
        </div>
        {accountOptions.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2" id="kakeibo-recurring-account-label">
              口座
            </span>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-recurring-account-label">
              <Chip role="radio" aria-checked={accountId === null} onClick={() => setAccountId(null)}>
                口座なし
              </Chip>
              {accountOptions.map((a) => (
                <Chip key={a.id} role="radio" aria-checked={accountId === a.id} onClick={() => setAccountId(a.id)}>
                  {a.name}
                </Chip>
              ))}
            </div>
          </div>
        )}
        <Field label="毎月の日" hint="31 を選ぶと、その月の月末になります">
          {(p) => (
            <Input
              {...p}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              value={dayOfMonth}
              onChange={(e) => setDayOfMonth(sanitizeAmountInput(e.target.value))}
              className="text-right"
            />
          )}
        </Field>
        {!recurring && (
          <Field label="始まりの月" hint="決めた日をもう過ぎていれば、今月の分をすぐ記録します">
            {(p) => <Input {...p} type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />}
          </Field>
        )}
        <Field label="終わりの月" hint="省けます">
          {(p) => (
            <Input
              {...p}
              type="month"
              value={endMonth}
              min={startMonth}
              onChange={(e) => setEndMonth(e.target.value)}
            />
          )}
        </Field>
        <Field label="メモ">{(p) => <Textarea {...p} value={memo} onChange={(e) => setMemo(e.target.value)} />}</Field>
        {recurring && (
          <Button type="button" variant="secondary" aria-pressed={paused} onClick={() => setPaused((v) => !v)}>
            {paused ? "動かす" : "止める"}
          </Button>
        )}
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
