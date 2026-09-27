/** 定期の記録を作る、直すシート。F-325、F-328 */
import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/parts/Chip";
import { Field } from "@/components/parts/Field";
import { FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { SheetFooterActions } from "@/components/parts/SheetFooterActions";
import { useSheetSubmit } from "@/components/parts/use-sheet-submit";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { defaultShareGroupId } from "@/lib/share-default";
import { KAKEIBO_EXPENSE_CATEGORIES, KAKEIBO_INCOME_CATEGORIES, type KakeiboCategory } from "../shared/categories";
import { isValidKakeiboAmount } from "../shared/format";
import type { KakeiboType } from "../shared/types";
import type { KakeiboRecurring, KakeiboRecurringOccurrence } from "./api";
import { useKakeiboAccounts, useSaveRecurring } from "./api";
import { sanitizeAmountInput } from "./numeric-input";
import { AccountPickerRow, monthKeyOf } from "./parts";

const TYPE_LABELS: Record<KakeiboType, string> = { expense: "支出", income: "収入", transfer: "振替" };

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const RECURRING_FORM_ID = "kakeibo-recurring-form";

/**
 * 定期の記録を作る、直すシート。種類、金額、カテゴリ、口座、メモ、グループ、毎月の日、始まりの月、
 * 終わりの月(省ける)を入れる。振替は、グループの代わりに出す元・入れる先の口座を選ぶ。
 * 振替を置くグループは、記録の振替と同じ決め方でサーバーが決める。0069、0072、0087、F-325、F-328
 */
export function RecurringSheet({
  groups,
  me,
  recurring,
  onClose,
  onCreated,
  onDelete,
  onSaved,
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
  /** 「消す」を押したとき。recurring があるときだけ渡る。#194 */
  onDelete?: (recurring: KakeiboRecurring) => void;
  /** 直して保存できたとき。recurring があるときだけ渡る。一覧の行を光らせる印に使う。0085、#226 */
  onSaved?: (id: string) => void;
}) {
  const saveRecurring = useSaveRecurring();
  // 開いているか・送信中か・失敗を、シートの骨組みとしてまとめて持つ。0081
  const { open, busy, error, submit: submitSheet, close, closeAndThen, handleClosed } = useSheetSubmit(onClose);

  const [groupId, setGroupIdState] = useState(
    recurring?.groupId ??
      defaultShareGroupId(groups, null, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "kakeibo",
        alwaysOn: false,
      }),
  );
  const [type, setType] = useState<KakeiboType>(recurring?.type ?? "expense");
  const [amountText, setAmountText] = useState(recurring ? String(recurring.amount) : "");
  const [category, setCategory] = useState<KakeiboCategory | null>(
    recurring && recurring.type !== "transfer" ? recurring.category : null,
  );
  const [accountId, setAccountId] = useState<string | null>(recurring?.accountId ?? null);
  const [toAccountId, setToAccountId] = useState<string | null>(recurring?.toAccountId ?? null);
  const [memo, setMemo] = useState(recurring?.memo ?? "");
  const [dayOfMonth, setDayOfMonth] = useState(recurring ? String(recurring.dayOfMonth) : String(new Date().getDate()));
  const [startMonth, setStartMonth] = useState(recurring?.startMonth ?? monthKeyOf(new Date()));
  const [endMonth, setEndMonth] = useState(recurring?.endMonth ?? "");
  const [paused, setPaused] = useState(Boolean(recurring?.paused));

  // グループを変えると選べる口座が変わるので、選び直させる。#194
  function setGroupId(next: string) {
    setGroupIdState(next);
    setAccountId(null);
  }

  // 種類を変えると、選べる口座やカテゴリが変わるので選び直させる。ExpenseSheet と同じ考え方。F-328
  function changeType(next: KakeiboType) {
    setType(next);
    setCategory(null);
    setAccountId(null);
    setToAccountId(null);
  }

  const selectedGroup = groups.find((g) => g.id === groupId);
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  // 振替は、選べる口座を「使えるグループ全部」から出す。支出・収入は、選んだグループの口座(共有のグループなら
  // 自分の口座も立て替えの側として)だけ。0069、F-319、F-328
  const accounts = useKakeiboAccounts(
    type === "transfer" ? null : selectedGroup?.isPersonal ? groupId : null,
    type === "transfer" || Boolean(selectedGroup?.isPersonal),
  );
  const sharedAccounts = useKakeiboAccounts(
    type !== "transfer" && selectedGroup && !selectedGroup.isPersonal ? groupId : null,
    type !== "transfer" && Boolean(selectedGroup) && !selectedGroup?.isPersonal,
  );
  const personalAccounts = useKakeiboAccounts(
    type !== "transfer" && selectedGroup && !selectedGroup.isPersonal ? personalGroupId : null,
    type !== "transfer" && Boolean(selectedGroup) && !selectedGroup?.isPersonal && Boolean(personalGroupId),
  );
  const accountOptions =
    type === "transfer"
      ? (accounts.data ?? [])
      : selectedGroup?.isPersonal
        ? (accounts.data ?? [])
        : [...(sharedAccounts.data ?? []), ...(personalAccounts.data ?? [])];

  const categories = type === "income" ? KAKEIBO_INCOME_CATEGORIES : KAKEIBO_EXPENSE_CATEGORIES;
  const amountValue = Number(amountText);
  const dayValue = Number(dayOfMonth);
  const amountOk = isValidKakeiboAmount(amountText);
  const categoryOk = type === "transfer" || category !== null;
  const transferOk = type !== "transfer" || (Boolean(accountId) && Boolean(toAccountId) && accountId !== toAccountId);
  const canSubmit =
    (type === "transfer" || Boolean(groupId)) &&
    categoryOk &&
    transferOk &&
    amountOk &&
    Number.isInteger(dayValue) &&
    dayValue >= 1 &&
    dayValue <= 31 &&
    /^\d{4}-\d{2}$/.test(startMonth) &&
    (endMonth === "" || endMonth >= startMonth);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitSheet(async () => {
      const shared = {
        type,
        amount: amountValue,
        category: type === "transfer" ? undefined : (category ?? undefined),
        accountId,
        toAccountId: type === "transfer" ? toAccountId : null,
        memo: memo || null,
        dayOfMonth: dayValue,
        startMonth,
        endMonth: endMonth || null,
      };
      if (recurring) {
        await saveRecurring.mutateAsync({ id: recurring.id, body: { ...shared, paused } });
        toast("定期の記録を直しました");
        onSaved?.(recurring.id);
      } else {
        const created = await saveRecurring.mutateAsync({
          body: { ...shared, groupId: type === "transfer" ? undefined : groupId },
        });
        if (created.occurrence) {
          onCreated(created.occurrence);
        } else {
          toast("定期の記録を作りました");
        }
      }
    });
  }

  /**
   * 消す。押すとシートを閉じ始め、5 秒の「元に戻す」は呼び出し側(RecurringsPage)に任せる。#194
   * ExpenseSheet と同じ、閉じる動きが終わってから知らせる形。#192
   */
  function remove() {
    if (!recurring) return;
    closeAndThen(() => onDelete?.(recurring));
  }

  return (
    <ResponsiveSheet
      title={recurring ? "定期の記録を直す" : "定期の記録を作る"}
      open={open}
      onOpenChange={close}
      onClose={handleClosed}
      footer={
        <SheetFooterActions
          formId={RECURRING_FORM_ID}
          busy={busy}
          canSubmit={canSubmit}
          onCancel={close}
          onDelete={recurring ? remove : undefined}
        />
      }
    >
      <form id={RECURRING_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="kakeibo-recurring-type-label">
            種類
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-recurring-type-label">
            {(Object.keys(TYPE_LABELS) as KakeiboType[]).map((t) => (
              <Chip key={t} role="radio" aria-checked={type === t} onClick={() => changeType(t)}>
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
              inputMode="decimal"
              pattern="[0-9]*"
              value={amountText}
              onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
              className="text-right text-xl font-bold"
            />
          )}
        </Field>
        {type !== "transfer" && (
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
        )}
        {/* 共有を口座の上に置き、選んだ直後に選べる口座が下に出る並びにする。0067、#194 */}
        {/* 振替はグループをサーバーが決めるので選ばせない。0069、F-328 */}
        {!recurring && type !== "transfer" && (
          <SharePickerRow groups={groups} me={me} value={groupId} onChange={setGroupId} extensionLabel="家計簿" />
        )}
        {type === "transfer" ? (
          <div className="flex flex-col gap-3.5">
            <AccountPickerRow
              label="出す元"
              accounts={accountOptions}
              value={accountId}
              onChange={setAccountId}
              allowNone={false}
              excludeId={toAccountId}
            />
            <AccountPickerRow
              label="入れる先"
              accounts={accountOptions}
              value={toAccountId}
              onChange={setToAccountId}
              allowNone={false}
              excludeId={accountId}
            />
          </div>
        ) : (
          <AccountPickerRow
            label="口座"
            accounts={accountOptions}
            value={accountId}
            onChange={setAccountId}
            allowNone
          />
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
