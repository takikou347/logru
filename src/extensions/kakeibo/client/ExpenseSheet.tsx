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
import { dateKey } from "@/lib/dates";
import { defaultShareGroupId } from "@/lib/share-default";
import { KAKEIBO_CATEGORIES, type KakeiboCategory } from "../shared/categories";
import type { KakeiboExpense } from "./api";
import { useDeleteExpense, useSaveExpense } from "./api";

/**
 * 記録するシート、直すシート。F-301、F-302、F-307
 *
 * 金額の欄は最初から数字の入力盤が開くようにする。カテゴリは既定を選ばず、押して選ぶ。
 * ホームの「記録する」から開くと、カテゴリを選んで保存するまで 3 タップと金額の入力 1 回で済む。F-305
 * 直すときは、書いた人だけが編集でき、消せる。ほかの人が開くと見るだけになる。
 *
 * @param expense 直す記録。無ければ新しく作る
 * @param defaultGroupId 最初に選ぶグループ。無ければ自分だけ
 */
export function ExpenseSheet({
  groups,
  me,
  expense,
  defaultGroupId,
  onClose,
}: {
  groups: GroupSummary[];
  me: Me;
  expense?: KakeiboExpense;
  defaultGroupId?: string | null;
  onClose: () => void;
}) {
  const saveExpense = useSaveExpense();
  const deleteExpense = useDeleteExpense();
  const canEdit = !expense || expense.createdBy === me.user.id;

  const [groupId, setGroupId] = useState(
    expense?.groupId ??
      defaultShareGroupId(groups, defaultGroupId, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "kakeibo",
        alwaysOn: false,
      }),
  );
  // 新しく記録するときだけ、いつもの共有先から選ばれたことが分かる印を出す。0063、F-40
  const usualDefault = !expense && groupId === me.settings.usualShareGroupId;
  const [date, setDate] = useState(expense?.date ?? dateKey(new Date()));
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState<KakeiboCategory | null>(expense?.category ?? null);
  const [memo, setMemo] = useState(expense?.memo ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const amountValue = Number(amount);
  const canSubmit =
    Boolean(date) &&
    category !== null &&
    amount !== "" &&
    Number.isInteger(amountValue) &&
    amountValue > 0 &&
    Boolean(groupId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit || category === null) return;
    setBusy(true);
    try {
      await saveExpense.mutateAsync({
        id: expense?.id,
        body: { groupId, date, amount: amountValue, category, memo: memo.trim() || null },
      });
      toast(expense ? "記録を直しました" : "記録しました");
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  /** 消す。押した後すぐ閉じ、失敗したら知らせる */
  function remove() {
    if (!expense) return;
    onClose();
    deleteExpense.mutate(expense.id, {
      onSuccess: () => toast("記録を消しました"),
      onError: (e) => toast.error((e as Error).message),
    });
  }

  return (
    <ResponsiveSheet title={!expense ? "記録する" : canEdit ? "記録を直す" : "記録"} onClose={onClose}>
      {!canEdit && <FieldMessage>この記録は見るだけです。直せて消せるのは、書いた人だけです。</FieldMessage>}
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <fieldset disabled={!canEdit} className="contents">
          <Field label="金額">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={1}
                max={1_000_000}
                step={1}
                placeholder="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-right text-2xl font-bold"
              />
            )}
          </Field>
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
              {KAKEIBO_CATEGORIES.map((c) => (
                <Chip
                  key={c.key}
                  role="radio"
                  aria-checked={category === c.key}
                  disabled={!canEdit}
                  onClick={() => setCategory(c.key)}
                >
                  {c.label}
                </Chip>
              ))}
            </div>
          </div>
          <Field label="日付">
            {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <SharePickerRow
            groups={groups}
            me={me}
            value={groupId}
            onChange={setGroupId}
            disabled={!canEdit}
            noneLabel="自分だけ"
            usualDefault={usualDefault}
          />
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
