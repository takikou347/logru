import type { GroupSummary, Me } from "@shared/api-types";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
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
import { KAKEIBO_EXPENSE_CATEGORIES, KAKEIBO_INCOME_CATEGORIES, type KakeiboCategory } from "../shared/categories";
import type { KakeiboSplitMode } from "../shared/splits";
import type { KakeiboType } from "../shared/types";
import type { KakeiboExpense, KakeiboTemplate, KakeiboUsage } from "./api";
import { useKakeiboAccounts, useKakeiboTemplates, useKakeiboUsage, useSaveExpense, useSaveTemplate } from "./api";
import { loadCategoryAccount, loadLastRecord, saveCategoryAccount, saveLastRecord } from "./local-prefs";
import { sanitizeAmountInput } from "./numeric-input";
import { AccountPickerRow } from "./parts";
import { PayerPickerRow, SplitModeSection } from "./SplitSection";

/** 支出は最初の 8 つだけ出し、残りは「ほか」で開く。F-314 */
const EXPENSE_CATEGORY_PREVIEW = 8;
/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const EXPENSE_FORM_ID = "kakeibo-expense-form";

const TYPE_LABELS: Record<KakeiboType, string> = { expense: "支出", income: "収入", transfer: "振替" };

/** カテゴリの ID を、その人の使った回数が多い順に並べる。同じ回数は元の並びのまま */
function orderByUsage(keys: readonly string[], usage: KakeiboUsage[]): string[] {
  const counts = new Map(usage.map((u) => [u.category, u.count]));
  return [...keys].sort((a, b) => (counts.get(b as KakeiboCategory) ?? 0) - (counts.get(a as KakeiboCategory) ?? 0));
}

/**
 * シートが持つ入力の値。種類・グループが変わったときに戻す値をまとめて 1 か所で持つ。#193
 * `date`・`memo` など、種類やグループが変わっても保つ値もここに含める。
 */
type ExpenseFormState = {
  type: KakeiboType;
  groupId: string;
  amount: string;
  category: KakeiboCategory | null;
  accountId: string | null;
  toAccountId: string | null;
  date: string;
  memo: string;
  payerId: string;
  splitMode: KakeiboSplitMode;
  customShares: Record<string, string>;
};

type ExpenseFormAction =
  | { kind: "changeType"; type: KakeiboType; meId: string }
  | { kind: "changeGroup"; groupId: string; meId: string }
  | { kind: "changeCategory"; category: KakeiboCategory; rememberedAccountId: string | null }
  | { kind: "applyTemplate"; template: KakeiboTemplate; meId: string; groupValid: boolean }
  | { kind: "lockPayer"; meId: string }
  | { kind: "set"; patch: Partial<ExpenseFormState> };

/** 種類を変えたときに戻す値。選べる口座やカテゴリが変わるので、選び直させる */
function resetForType(state: ExpenseFormState, type: KakeiboType, meId: string): ExpenseFormState {
  return {
    ...state,
    type,
    category: null,
    accountId: null,
    toAccountId: null,
    payerId: meId,
    splitMode: "equal",
    customShares: {},
  };
}

/** グループを変えたときに戻す値。選べる口座、立て替えの人と割り方が変わる */
function resetForGroup(state: ExpenseFormState, groupId: string, meId: string): ExpenseFormState {
  return { ...state, groupId, accountId: null, payerId: meId, splitMode: "equal", customShares: {} };
}

function expenseFormReducer(state: ExpenseFormState, action: ExpenseFormAction): ExpenseFormState {
  switch (action.kind) {
    case "changeType":
      return resetForType(state, action.type, action.meId);
    case "changeGroup":
      return resetForGroup(state, action.groupId, action.meId);
    case "changeCategory":
      return {
        ...state,
        category: action.category,
        accountId: action.rememberedAccountId ?? state.accountId,
      };
    case "applyTemplate": {
      const t = action.template;
      let next = resetForType(state, t.type, action.meId);
      if (t.groupId && action.groupValid && t.groupId !== next.groupId) {
        next = resetForGroup(next, t.groupId, action.meId);
      }
      next = { ...next, category: t.category, accountId: t.accountId, memo: t.memo ?? "" };
      if (t.amount !== null) next.amount = String(t.amount);
      return next;
    }
    case "lockPayer":
      return state.payerId === action.meId ? state : { ...state, payerId: action.meId };
    case "set":
      return { ...state, ...action.patch };
  }
}

/**
 * 記録するシート、直すシート。支出・収入・振替の 3 種類を、この 1 つのシートで扱う。0069
 * F-301、F-302、F-307、F-310、F-311、F-314
 *
 * 金額の欄は開くと自動でフォーカスし、数字の入力盤が開くようにする。カテゴリは、その人がよく使う順に並ぶ。
 * 前回の種類・口座・共有先はこの端末に覚えさせ、次に開いたときの既定にする。サーバーには持たない。
 * 直すときは、共有のグループの記録ならメンバーの誰でも編集でき、消せる。自分だけの記録は書いた人だけ。0079
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
  const templates = useKakeiboTemplates();
  const saveTemplate = useSaveTemplate();
  // 共有のグループの記録は誰でも直せる。自分だけのグループは書いた人だけ。0079
  const expenseGroup = groups.find((g) => g.id === expense?.groupId);
  const isSharedGroupRecord = expenseGroup !== undefined && !expenseGroup.isPersonal;
  const canEdit = !expense || isSharedGroupRecord || expense.createdBy === me.user.id;
  const amountRef = useRef<HTMLInputElement>(null);
  const dateFieldRef = useRef<HTMLDivElement>(null);
  const amountFieldRef = useRef<HTMLDivElement>(null);
  const categoryFieldRef = useRef<HTMLDivElement>(null);
  const transferFieldRef = useRef<HTMLDivElement>(null);
  const [namingTemplate, setNamingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState("");
  // 保存を押したのに足りない欄があったとき true。以後、欄の下に理由を出す。#193
  const [attempted, setAttempted] = useState(false);

  const [state, dispatch] = useReducer(expenseFormReducer, undefined, (): ExpenseFormState => {
    const last = expense ? null : loadLastRecord();
    const initialGroupId = defaultShareGroupId(groups, defaultGroupId ?? expense?.groupId ?? last?.groupId, {
      groupId: me.settings.usualShareGroupId,
      extensionKey: "kakeibo",
      alwaysOn: false,
    });
    const customShares: Record<string, string> =
      expense?.splitMode === "custom" && expense.splits
        ? Object.fromEntries(
            expense.splits
              .filter((s): s is { userId: string; amount: number } => s.userId !== null)
              .map((s) => [s.userId, String(s.amount)]),
          )
        : {};
    return {
      type: expense?.type ?? last?.type ?? "expense",
      groupId: initialGroupId,
      amount: expense ? String(expense.amount) : "",
      category: expense && expense.type !== "transfer" ? expense.category : null,
      accountId: expense?.account && !("hidden" in expense.account) ? expense.account.id : (last?.accountId ?? null),
      toAccountId:
        expense?.toAccount && !("hidden" in expense.toAccount) ? expense.toAccount.id : (last?.toAccountId ?? null),
      date: expense?.date ?? dateKey(new Date()),
      memo: expense?.memo ?? "",
      payerId: expense?.paidBy ?? me.user.id,
      splitMode: expense?.splitMode ?? "equal",
      customShares,
    };
  });
  const { type, groupId, amount, category, accountId, toAccountId, date, memo, payerId, splitMode, customShares } =
    state;
  // 新しく記録するときだけ、いつもの共有先から選ばれたことが分かる印を出す。0063、F-40
  const usualDefault = !expense && groupId === me.settings.usualShareGroupId;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandCategories, setExpandCategories] = useState(false);
  // 開いているか。閉じる動きは ResponsiveSheet に任せ、終わってから onClose を呼ぶ。#192
  const [open, setOpen] = useState(true);
  // 閉じる動きが終わってから消す。消す先の記録を、閉じ始めた時点で覚えておく
  const afterClose = useRef<KakeiboExpense | null>(null);

  const selectedGroup = groups.find((g) => g.id === groupId);
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  // 割るかどうか。支出で、共有のグループで払ったとき。共有口座を選んだ支出は割らない。0072
  const splitCandidate = type === "expense" && Boolean(selectedGroup) && !selectedGroup?.isPersonal;

  // 振替と、立て替えの候補は、選べる口座を「使えるグループ全部」から出す。支出・収入は、選んだグループの口座だけ。0069、F-319
  const accounts = useKakeiboAccounts(type === "transfer" || splitCandidate ? null : groupId);
  const accountOptions = useMemo(() => {
    const data = accounts.data ?? [];
    return splitCandidate ? data.filter((a) => a.groupId === groupId || a.groupId === personalGroupId) : data;
  }, [accounts.data, splitCandidate, groupId, personalGroupId]);
  const selectedAccount = accountOptions.find((a) => a.id === accountId);
  const selectedToAccount = accountOptions.find((a) => a.id === toAccountId);
  const splitting = splitCandidate && (accountId === null || selectedAccount?.groupId !== groupId);
  // 自分の口座を選んだら、その口座の持ち主(自分)しか払った人に選べない。0072
  const payerLocked = Boolean(accountId) && selectedAccount?.groupId === personalGroupId;
  const splitMembers = selectedGroup?.members ?? [];
  const splitPeopleIds = [me.user.id, ...splitMembers.filter((m) => m.id !== me.user.id).map((m) => m.id)];
  const customSplitTotal = splitPeopleIds.reduce((n, id) => n + (Number(customShares[id]) || 0), 0);

  useEffect(() => {
    if (payerLocked) dispatch({ kind: "lockPayer", meId: me.user.id });
  }, [payerLocked, me.user.id]);

  /**
   * 口座の一覧が読めた時点で、選んでいる口座がいまの種類・グループで選べなければ null に戻す。
   * 端末に覚えた前回の口座が、いまは選べない口座を指しているときに、選べない口座を送って
   * 保存に失敗するのを防ぐ。#193
   */
  useEffect(() => {
    if (!accounts.data) return;
    if (accountId && !accountOptions.some((a) => a.id === accountId)) {
      dispatch({ kind: "set", patch: { accountId: null } });
    }
    if (type === "transfer" && toAccountId && !accountOptions.some((a) => a.id === toAccountId)) {
      dispatch({ kind: "set", patch: { toAccountId: null } });
    }
  }, [accounts.data, accountOptions, accountId, toAccountId, type]);

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

  function changeType(next: KakeiboType) {
    dispatch({ kind: "changeType", type: next, meId: me.user.id });
    setExpandCategories(false);
  }

  // カテゴリを選ぶと、そのカテゴリで前回使った口座が選ばれる。口座を手で選んだら、そちらを使う。F-327
  function changeCategory(next: KakeiboCategory) {
    const remembered = loadCategoryAccount(next);
    const rememberedAccountId = remembered && accountOptions.some((a) => a.id === remembered) ? remembered : null;
    dispatch({ kind: "changeCategory", category: next, rememberedAccountId });
  }

  function changeGroup(next: string) {
    dispatch({ kind: "changeGroup", groupId: next, meId: me.user.id });
  }

  /**
   * よく使う記録を押すと、種類・カテゴリ・口座・グループ・メモが入り、金額を持つものは金額も入る。F-326
   * 種類・グループの切り替えと同じ経路(reducer)を通し、いまはもう使えなくなったグループなら入れない。#193
   */
  function applyTemplate(t: KakeiboTemplate) {
    const groupValid = Boolean(t.groupId) && groups.some((g) => g.id === t.groupId);
    dispatch({ kind: "applyTemplate", template: t, meId: me.user.id, groupValid });
    setExpandCategories(false);
  }

  async function saveAsTemplate() {
    const value = templateName.trim();
    if (!value || type === "transfer") return;
    try {
      await saveTemplate.mutateAsync({
        body: {
          name: value,
          type,
          groupId,
          category,
          accountId,
          memo: memo.trim() || null,
          amount: amountOk ? amountValue : null,
        },
      });
      toast("よく使う記録にしました");
      setNamingTemplate(false);
      setTemplateName("");
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  const amountValue = Number(amount);
  const amountOk = amount !== "" && Number.isInteger(amountValue) && amountValue > 0 && amountValue <= 100_000_000;
  const dateOk = Boolean(date);
  const categoryOk = type === "transfer" || category !== null;
  const transferOk = type !== "transfer" || (Boolean(accountId) && Boolean(toAccountId) && accountId !== toAccountId);
  const splitOk = !splitting || splitMode !== "custom" || customSplitTotal === amountValue;
  const canSubmit = dateOk && amountOk && categoryOk && transferOk && splitOk && Boolean(groupId);

  const amountError = attempted && !amountOk ? "金額は 1 円から 1 億円までの整数で入れてください。" : null;
  const dateError = attempted && !dateOk ? "日付を入れてください。" : null;
  const categoryError = attempted && !categoryOk ? "カテゴリを選んでください。" : null;
  const transferError =
    attempted && !transferOk
      ? accountId && toAccountId && accountId === toAccountId
        ? "出す元と入れる先は、別の口座を選んでください。"
        : "出す元と入れる先を選んでください。"
      : null;

  async function submit(keepOpen: boolean) {
    setError(null);
    if (!canSubmit) {
      setAttempted(true);
      const target = !dateOk
        ? dateFieldRef
        : !amountOk
          ? amountFieldRef
          : !categoryOk || !transferOk
            ? type === "transfer"
              ? transferFieldRef
              : categoryFieldRef
            : null;
      target?.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setBusy(true);
    try {
      // 表示している選択とそろえ、いまは選べない口座が残っていても送らない。#193
      const submittedAccountId = selectedAccount?.id ?? null;
      const submittedToAccountId = selectedToAccount?.id ?? null;
      await saveExpense.mutateAsync({
        id: expense?.id,
        body: {
          type,
          groupId: type === "transfer" ? undefined : groupId,
          date,
          amount: amountValue,
          category: type === "transfer" ? undefined : category,
          accountId: submittedAccountId,
          toAccountId: type === "transfer" ? submittedToAccountId : undefined,
          memo: memo.trim() || null,
          paidBy: splitting ? payerId : undefined,
          splitMode: splitting ? splitMode : undefined,
          splits:
            splitting && splitMode === "custom"
              ? splitPeopleIds.map((id) => ({ userId: id, amount: Number(customShares[id]) || 0 }))
              : undefined,
        },
      });
      saveLastRecord({ type, accountId: submittedAccountId, toAccountId: submittedToAccountId, groupId });
      if (type !== "transfer" && category) saveCategoryAccount(category, submittedAccountId);
      toast(expense ? "記録を直しました" : "記録しました");
      setAttempted(false);
      if (keepOpen) {
        dispatch({ kind: "set", patch: { amount: "", memo: "" } });
        amountRef.current?.focus();
      } else {
        setOpen(false);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /**
   * 消す。押すとシートを閉じ始め、5 秒の「元に戻す」は呼び出し側(KakeiboPage)に任せる。
   * 閉じる動きの途中で「元に戻す」の知らせを出すと、閉じる後片付けと知らせの表示が競合し、
   * 知らせの中身が描かれないことがある。動きが終わってから呼ぶ。#192
   */
  function remove() {
    if (!expense) return;
    afterClose.current = expense;
    setOpen(false);
  }

  /** 閉じる動きが終わってから、親に知らせる。消す記録を覚えていたら、そのあと消す。#192 */
  function handleClosed() {
    onClose();
    const pending = afterClose.current;
    afterClose.current = null;
    if (pending) onDelete?.(pending);
  }

  return (
    <ResponsiveSheet
      title={!expense ? "記録する" : canEdit ? "記録を直す" : "記録"}
      open={open}
      onOpenChange={() => setOpen(false)}
      onClose={handleClosed}
      footer={
        canEdit ? (
          <div className="flex flex-col gap-2">
            <div className="flex justify-between gap-2">
              {expense ? (
                <Button type="button" variant="danger" onClick={remove}>
                  消す
                </Button>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  やめる
                </Button>
              )}
              <Button type="submit" form={EXPENSE_FORM_ID} disabled={busy}>
                {busy ? "保存しています" : "保存する"}
              </Button>
            </div>
            {!expense && (
              <Button type="button" variant="secondary" disabled={busy} onClick={() => void submit(true)}>
                続けて記録
              </Button>
            )}
          </div>
        ) : (
          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
              閉じる
            </Button>
          </div>
        )
      }
    >
      {!canEdit && (
        <FieldMessage>この記録は見るだけです。自分だけの記録は、書いた人だけが直せて、消せます。</FieldMessage>
      )}
      <form
        id={EXPENSE_FORM_ID}
        className="flex flex-col gap-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(false);
        }}
        noValidate
      >
        <fieldset disabled={!canEdit} className="contents">
          {!expense && (templates.data?.length ?? 0) > 0 && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-ink-2">よく使う</span>
              <div className="flex flex-wrap gap-2">
                {templates.data!.map((t) => (
                  <Chip key={t.id} type="button" onClick={() => applyTemplate(t)}>
                    {t.name}
                  </Chip>
                ))}
              </div>
            </div>
          )}
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

          <div ref={amountFieldRef}>
            <Field label="金額" error={amountError}>
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
                  onChange={(e) => dispatch({ kind: "set", patch: { amount: sanitizeAmountInput(e.target.value) } })}
                  className="text-right text-2xl font-bold"
                />
              )}
            </Field>
          </div>

          {type !== "transfer" && (
            <div ref={categoryFieldRef} className="flex flex-col gap-1.5">
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
                    onClick={() => changeCategory(key as KakeiboCategory)}
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
              {categoryError && <FieldMessage error>{categoryError}</FieldMessage>}
            </div>
          )}

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

          {type === "transfer" ? (
            <div ref={transferFieldRef} className="flex flex-col gap-3.5">
              <AccountPickerRow
                label="出す元"
                accounts={accountOptions}
                value={accountId}
                onChange={(id) => dispatch({ kind: "set", patch: { accountId: id } })}
                allowNone={false}
                excludeId={toAccountId}
                disabled={!canEdit}
              />
              <AccountPickerRow
                label="入れる先"
                accounts={accountOptions}
                value={toAccountId}
                onChange={(id) => dispatch({ kind: "set", patch: { toAccountId: id } })}
                allowNone={false}
                excludeId={accountId}
                disabled={!canEdit}
              />
              {transferError && <FieldMessage error>{transferError}</FieldMessage>}
            </div>
          ) : (
            <AccountPickerRow
              label="口座"
              accounts={accountOptions}
              value={accountId}
              onChange={(id) => dispatch({ kind: "set", patch: { accountId: id } })}
              allowNone
              disabled={!canEdit}
              recordGroupId={splitCandidate ? groupId : null}
            />
          )}

          {splitting && (
            <>
              <PayerPickerRow
                groups={groups}
                members={splitMembers}
                me={me}
                value={payerId}
                onChange={(id) => dispatch({ kind: "set", patch: { payerId: id } })}
                disabled={!canEdit || payerLocked}
                disabledReason={payerLocked ? "自分の口座を選んだので、払った人は自分になります。" : undefined}
              />
              <SplitModeSection
                groups={groups}
                members={splitMembers}
                me={me}
                mode={splitMode}
                onChangeMode={(mode) => dispatch({ kind: "set", patch: { splitMode: mode } })}
                amount={amountOk ? amountValue : 0}
                customShares={customShares}
                onChangeCustomShares={(next) => dispatch({ kind: "set", patch: { customShares: next } })}
              />
            </>
          )}

          <div ref={dateFieldRef}>
            <Field label="日付" error={dateError}>
              {(p) => (
                <Input
                  {...p}
                  type="date"
                  value={date}
                  onChange={(e) => dispatch({ kind: "set", patch: { date: e.target.value } })}
                />
              )}
            </Field>
          </div>
          <Field label="メモ">
            {(p) => (
              <Textarea
                {...p}
                value={memo}
                maxLength={200}
                placeholder={canEdit ? "お店の名前など" : undefined}
                onChange={(e) => dispatch({ kind: "set", patch: { memo: e.target.value } })}
              />
            )}
          </Field>
          {!expense && type !== "transfer" && (
            <div className="flex flex-col gap-1.5">
              {namingTemplate ? (
                <Field label="よく使う記録の名前">
                  {(p) => (
                    <div className="flex gap-2">
                      <Input
                        {...p}
                        autoFocus
                        value={templateName}
                        maxLength={30}
                        onChange={(e) => setTemplateName(e.target.value)}
                        onKeyDown={(e) => {
                          // Enter は、この欄をよく使う記録として残すためのもの。form の送信(記録の保存)は起こさない。#193
                          if (e.key !== "Enter") return;
                          e.preventDefault();
                          if (templateName.trim() && !saveTemplate.isPending) void saveAsTemplate();
                        }}
                      />
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!templateName.trim() || saveTemplate.isPending}
                        onClick={() => void saveAsTemplate()}
                      >
                        {saveTemplate.isPending ? "残しています" : "残す"}
                      </Button>
                    </div>
                  )}
                </Field>
              ) : (
                <Button type="button" variant="ghost" onClick={() => setNamingTemplate(true)}>
                  よく使う記録にする
                </Button>
              )}
            </div>
          )}
        </fieldset>
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
