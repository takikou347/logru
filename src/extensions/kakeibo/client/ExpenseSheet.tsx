import type { GroupSummary, Me } from "@shared/api-types";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/parts/Chip";
import { EmptyState } from "@/components/parts/EmptyState";
import { Field } from "@/components/parts/Field";
import { FieldMessage, RowButton } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { dateKey } from "@/lib/dates";
import { defaultShareGroupId } from "@/lib/share-default";
import { KAKEIBO_EXPENSE_CATEGORIES, KAKEIBO_INCOME_CATEGORIES, type KakeiboCategory } from "../shared/categories";
import type { KakeiboType } from "../shared/types";
import type { KakeiboAccount, KakeiboExpense, KakeiboUsage } from "./api";
import { useKakeiboAccounts, useKakeiboUsage, useSaveExpense } from "./api";
import { loadLastRecord, saveLastRecord } from "./local-prefs";
import { sanitizeAmountInput } from "./numeric-input";
import { KAKEIBO_ACCOUNT_KIND_ICONS } from "./parts";

/** 支出は最初の 8 つだけ出し、残りは「ほか」で開く。F-314 */
const EXPENSE_CATEGORY_PREVIEW = 8;

const TYPE_LABELS: Record<KakeiboType, string> = { expense: "支出", income: "収入", transfer: "振替" };

/** カテゴリの ID を、その人の使った回数が多い順に並べる。同じ回数は元の並びのまま */
function orderByUsage(keys: readonly string[], usage: KakeiboUsage[]): string[] {
  const counts = new Map(usage.map((u) => [u.category, u.count]));
  return [...keys].sort((a, b) => (counts.get(b as KakeiboCategory) ?? 0) - (counts.get(a as KakeiboCategory) ?? 0));
}

/**
 * 口座を選ぶ行。支出・収入の「口座」と、振替の「出す元」「入れる先」で使う。
 * 「使わない」にした口座は、いま選んでいるものでなければ一覧に出さない。F-309
 */
function AccountPickerRow({
  label,
  accounts,
  value,
  onChange,
  allowNone,
  excludeId,
  disabled,
}: {
  label: string;
  accounts: KakeiboAccount[];
  value: string | null;
  onChange: (id: string | null) => void;
  allowNone: boolean;
  excludeId?: string | null;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const options = accounts.filter((a) => (!a.archivedAt || a.id === value) && a.id !== excludeId);
  const chosen = options.find((a) => a.id === value);
  return (
    <div>
      <RowButton type="button" disabled={disabled} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <span>{label}</span>
        <span className="flex min-w-0 flex-1 items-center justify-end gap-1.5 text-ink-2">
          <span className="min-w-0 truncate">{chosen ? chosen.name : "口座なし"}</span>
        </span>
      </RowButton>
      {open && (
        <ResponsiveSheet title={label} onClose={() => setOpen(false)}>
          {options.length === 0 ? (
            <EmptyState pose="coin" bordered={false} action={{ label: "口座を作る", to: "/kakeibo/accounts" }}>
              まだ口座がありません。作ると、ここで選べます。
            </EmptyState>
          ) : (
            <div role="radiogroup" aria-label={label} className="flex flex-col">
              {allowNone && (
                <button
                  type="button"
                  role="radio"
                  aria-checked={value === null}
                  onClick={() => {
                    onChange(null);
                    setOpen(false);
                  }}
                  className="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-ink-2">口座なし</span>
                </button>
              )}
              {options.map((a) => {
                const Icon = KAKEIBO_ACCOUNT_KIND_ICONS[a.kind];
                return (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={value === a.id}
                    onClick={() => {
                      onChange(a.id);
                      setOpen(false);
                    }}
                    className="flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] last:border-b-0"
                  >
                    <Icon className="size-4 flex-none text-ink-2" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </ResponsiveSheet>
      )}
    </div>
  );
}

/**
 * 記録するシート、直すシート。支出・収入・振替の 3 種類を、この 1 つのシートで扱う。0069
 * F-301、F-302、F-307、F-310、F-311、F-314
 *
 * 金額の欄は開くと自動でフォーカスし、数字の入力盤が開くようにする。カテゴリは、その人がよく使う順に並ぶ。
 * 前回の種類・口座・共有先はこの端末に覚えさせ、次に開いたときの既定にする。サーバーには持たない。
 * 直すときは、書いた人だけが編集でき、消せる。ほかの人が開くと見るだけになる。
 *
 * @param expense 直す記録。無ければ新しく作る
 * @param defaultGroupId 最初に選ぶグループ。無ければ前回か自分だけ
 * @param onDelete 「消す」を押したとき。expense があるときだけ渡る
 */
export function ExpenseSheet({
  groups,
  me,
  expense,
  defaultGroupId,
  onClose,
  onDelete,
}: {
  groups: GroupSummary[];
  me: Me;
  expense?: KakeiboExpense;
  defaultGroupId?: string | null;
  onClose: () => void;
  onDelete?: (expense: KakeiboExpense) => void;
}) {
  const saveExpense = useSaveExpense();
  const usage = useKakeiboUsage();
  const canEdit = !expense || expense.createdBy === me.user.id;
  const last = useMemo(() => (expense ? null : loadLastRecord()), [expense]);
  const amountRef = useRef<HTMLInputElement>(null);

  const [type, setType] = useState<KakeiboType>(expense?.type ?? last?.type ?? "expense");
  const [groupId, setGroupId] = useState(
    defaultShareGroupId(groups, defaultGroupId ?? expense?.groupId ?? last?.groupId, {
      groupId: me.settings.usualShareGroupId,
      extensionKey: "kakeibo",
      alwaysOn: false,
    }),
  );
  // 新しく記録するときだけ、いつもの共有先から選ばれたことが分かる印を出す。0063、F-40
  const usualDefault = !expense && groupId === me.settings.usualShareGroupId;
  const [date, setDate] = useState(expense?.date ?? dateKey(new Date()));
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState<KakeiboCategory | null>(
    expense && expense.type !== "transfer" ? expense.category : null,
  );
  const [accountId, setAccountId] = useState<string | null>(
    expense?.account && !("hidden" in expense.account) ? expense.account.id : (last?.accountId ?? null),
  );
  const [toAccountId, setToAccountId] = useState<string | null>(
    expense?.toAccount && !("hidden" in expense.toAccount) ? expense.toAccount.id : (last?.toAccountId ?? null),
  );
  const [memo, setMemo] = useState(expense?.memo ?? "");
  const [expandCategories, setExpandCategories] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // 振替は、選べる口座を「使えるグループ全部」から出す。支出・収入は、選んだグループの口座だけ。0069
  const accounts = useKakeiboAccounts(type === "transfer" ? null : groupId);
  const categoryKeys =
    type === "income" ? KAKEIBO_INCOME_CATEGORIES.map((c) => c.key) : KAKEIBO_EXPENSE_CATEGORIES.map((c) => c.key);
  const orderedCategories = useMemo(
    () => orderByUsage(categoryKeys, type === "income" ? (usage.data?.income ?? []) : (usage.data?.expense ?? [])),
    [categoryKeys, type, usage.data],
  );
  const categoryLabels = new Map<string, string>(
    [...KAKEIBO_EXPENSE_CATEGORIES, ...KAKEIBO_INCOME_CATEGORIES].map((c) => [c.key, c.label]),
  );
  const previewCount = type === "expense" ? EXPENSE_CATEGORY_PREVIEW : orderedCategories.length;
  const expanded =
    expandCategories || (category !== null && !orderedCategories.slice(0, previewCount).includes(category));
  const shownCategories = expanded ? orderedCategories : orderedCategories.slice(0, previewCount);

  // 種類とグループで選べる口座が変わるので、切り替えたら選び直させる
  function changeType(next: KakeiboType) {
    setType(next);
    setCategory(null);
    setExpandCategories(false);
    setAccountId(null);
    setToAccountId(null);
  }

  function changeGroup(next: string) {
    setGroupId(next);
    setAccountId(null);
  }

  const amountValue = Number(amount);
  const amountOk = amount !== "" && Number.isInteger(amountValue) && amountValue > 0 && amountValue <= 100_000_000;
  const canSubmit =
    Boolean(date) &&
    amountOk &&
    (type === "transfer"
      ? Boolean(accountId) && Boolean(toAccountId) && accountId !== toAccountId
      : category !== null && Boolean(groupId));

  async function submit(keepOpen: boolean) {
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      await saveExpense.mutateAsync({
        id: expense?.id,
        body: {
          type,
          groupId: type === "transfer" ? undefined : groupId,
          date,
          amount: amountValue,
          category: type === "transfer" ? undefined : category,
          accountId,
          toAccountId: type === "transfer" ? toAccountId : undefined,
          memo: memo.trim() || null,
        },
      });
      saveLastRecord({ type, accountId, toAccountId, groupId });
      toast(expense ? "記録を直しました" : "記録しました");
      if (keepOpen) {
        setAmount("");
        setMemo("");
        amountRef.current?.focus();
      } else {
        onClose();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 消す。押すとシートを閉じ、5 秒の「元に戻す」は呼び出し側(KakeiboPage)に任せる。
   *
   * シートの閉じるアニメーション(ResponsiveSheet、最長 300ms)の途中で「元に戻す」の知らせを出すと、
   * 閉じる後片付けと知らせの表示が競合し、知らせの中身が描かれないことがある。アニメーションが終わってから
   * 呼ぶよう、閉じるアニメーションより長めに遅らせる
   */
  function remove() {
    if (!expense) return;
    const target = expense;
    onClose();
    setTimeout(() => onDelete?.(target), 400);
  }

  return (
    <ResponsiveSheet title={!expense ? "記録する" : canEdit ? "記録を直す" : "記録"} onClose={onClose}>
      {!canEdit && <FieldMessage>この記録は見るだけです。直せて消せるのは、書いた人だけです。</FieldMessage>}
      <form
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        noValidate
      >
        <fieldset disabled={!canEdit} className="contents">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-ink-2" id="kakeibo-type-label">
              種類
            </span>
            <div className="flex gap-2" role="radiogroup" aria-labelledby="kakeibo-type-label">
              {(Object.keys(TYPE_LABELS) as KakeiboType[]).map((t) => (
                <Chip key={t} role="radio" aria-checked={type === t} disabled={!canEdit} onClick={() => changeType(t)}>
                  {TYPE_LABELS[t]}
                </Chip>
              ))}
            </div>
          </div>

          <Field label="金額">
            {(p) => (
              <Input
                {...p}
                ref={amountRef}
                autoFocus
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(sanitizeAmountInput(e.target.value))}
                className="text-right text-2xl font-bold"
              />
            )}
          </Field>

          {type !== "transfer" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2" id="kakeibo-category-label">
                カテゴリ
              </span>
              <div
                className="flex flex-wrap gap-2"
                role="radiogroup"
                aria-labelledby="kakeibo-category-label"
                aria-required="true"
              >
                {shownCategories.map((key) => (
                  <Chip
                    key={key}
                    role="radio"
                    aria-checked={category === key}
                    disabled={!canEdit}
                    onClick={() => setCategory(key as KakeiboCategory)}
                  >
                    {categoryLabels.get(key)}
                  </Chip>
                ))}
                {!expanded && orderedCategories.length > previewCount && (
                  <Chip type="button" disabled={!canEdit} onClick={() => setExpandCategories(true)}>
                    ほか
                  </Chip>
                )}
              </div>
            </div>
          )}

          {type === "transfer" ? (
            <>
              <AccountPickerRow
                label="出す元"
                accounts={accounts.data ?? []}
                value={accountId}
                onChange={setAccountId}
                allowNone={false}
                excludeId={toAccountId}
                disabled={!canEdit}
              />
              <AccountPickerRow
                label="入れる先"
                accounts={accounts.data ?? []}
                value={toAccountId}
                onChange={setToAccountId}
                allowNone={false}
                excludeId={accountId}
                disabled={!canEdit}
              />
            </>
          ) : (
            <AccountPickerRow
              label="口座"
              accounts={accounts.data ?? []}
              value={accountId}
              onChange={setAccountId}
              allowNone
              disabled={!canEdit}
            />
          )}

          <Field label="日付">
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          {type !== "transfer" && (
            <SharePickerRow
              groups={groups}
              me={me}
              value={groupId}
              onChange={changeGroup}
              disabled={!canEdit}
              usualDefault={usualDefault}
              extensionLabel="家計簿"
            />
          )}
          <Field label="メモ">
            {(p) => (
              <Textarea
                {...p}
                value={memo}
                maxLength={200}
                placeholder={canEdit ? "お店の名前など" : undefined}
                onChange={(e) => setMemo(e.target.value)}
              />
            )}
          </Field>
        </fieldset>
        {error && <FieldMessage error>{error}</FieldMessage>}
        {canEdit ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              {expense ? (
                <Button type="button" variant="danger" onClick={remove}>
                  消す
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={onClose}>
                  やめる
                </Button>
              )}
              <Button type="submit" disabled={busy || !canSubmit}>
                {busy ? "保存しています" : "保存する"}
              </Button>
            </div>
            {!expense && (
              <Button type="button" variant="secondary" disabled={busy || !canSubmit} onClick={() => void submit(true)}>
                続けて記録
              </Button>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={onClose}>
              閉じる
            </Button>
          </div>
        )}
      </form>
    </ResponsiveSheet>
  );
}
