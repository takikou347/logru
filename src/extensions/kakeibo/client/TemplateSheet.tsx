/**
 * よく使う記録を直すシート。記録のシート(ExpenseSheet)と同じ部品で、名前・種類・カテゴリ・口座・
 * グループ・金額・メモの全部を直せる。振替のよく使う記録はまだ作れないので、種類は支出・収入だけ。0072、F-326
 *
 * issue #248: いままでは名前しか直せず、種類やカテゴリ、口座を直したいときは消して作り直すしかなかった。
 */
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
import { Input, Textarea } from "@/components/ui/input";
import { defaultShareGroupId } from "@/lib/share-default";
import { KAKEIBO_EXPENSE_CATEGORIES, KAKEIBO_INCOME_CATEGORIES, type KakeiboCategory } from "../shared/categories";
import { isValidKakeiboAmount } from "../shared/format";
import type { KakeiboTemplate } from "./api";
import { useKakeiboAccounts, useSaveTemplate } from "./api";
import { sanitizeAmountInput } from "./numeric-input";
import { AccountPickerRow } from "./parts";

/** 振替以外の種類。振替のよく使う記録はまだ作れない。assertCategory(server)と同じ制約。0072、F-326 */
type KakeiboTemplateType = "expense" | "income";

const TEMPLATE_TYPE_LABELS: Record<KakeiboTemplateType, string> = { expense: "支出", income: "収入" };

/** 下の footer のボタンから、シートの中の form を submit するのに使う */
const TEMPLATE_FORM_ID = "kakeibo-template-form";

/**
 * よく使う記録を直すシート。TemplatesPage から、行を押すと開く。
 * @param template 直すよく使う記録
 * @param onSaved 保存できたとき。一覧の行を光らせる印に使う。0085、#226
 */
export function TemplateSheet({
  groups,
  me,
  template,
  onClose,
  onSaved,
}: {
  groups: GroupSummary[];
  me: Me;
  template: KakeiboTemplate;
  onClose: () => void;
  onSaved?: (id: string) => void;
}) {
  const saveTemplate = useSaveTemplate();
  const { open, busy, error, submit: submitSheet, close, handleClosed } = useSheetSubmit(onClose);

  const [name, setName] = useState(template.name);
  const [type, setType] = useState<KakeiboTemplateType>(template.type === "income" ? "income" : "expense");
  const [category, setCategory] = useState<KakeiboCategory | null>(template.category);
  const [amountText, setAmountText] = useState(template.amount === null ? "" : String(template.amount));
  const [memo, setMemo] = useState(template.memo ?? "");
  const [groupId, setGroupIdState] = useState(
    defaultShareGroupId(groups, template.groupId, {
      groupId: me.settings.usualShareGroupId,
      extensionKey: "kakeibo",
      alwaysOn: false,
    }),
  );
  const [accountId, setAccountIdState] = useState<string | null>(template.accountId);

  // 種類を変えると、選べるカテゴリが変わるので選び直させる。ExpenseSheet と同じ考え方
  function changeType(next: KakeiboTemplateType) {
    setType(next);
    setCategory(null);
  }

  // グループを変えると選べる口座が変わるので選び直させる
  function changeGroup(next: string) {
    setGroupIdState(next);
    setAccountIdState(null);
  }

  const selectedGroup = groups.find((g) => g.id === groupId);
  const personalGroupId = groups.find((g) => g.isPersonal)?.id ?? null;
  // 支出で共有のグループなら、立て替えの候補として自分の口座も選べる。ExpenseSheet と同じ。0072、F-319
  const splitCandidate = type === "expense" && Boolean(selectedGroup) && !selectedGroup?.isPersonal;
  const accounts = useKakeiboAccounts(splitCandidate ? null : groupId);
  const accountOptions = splitCandidate
    ? (accounts.data ?? []).filter((a) => a.groupId === groupId || a.groupId === personalGroupId)
    : (accounts.data ?? []);

  const categories = type === "income" ? KAKEIBO_INCOME_CATEGORIES : KAKEIBO_EXPENSE_CATEGORIES;
  const amountOk = amountText === "" || isValidKakeiboAmount(amountText);
  const canSubmit = name.trim().length > 0 && amountOk && Boolean(groupId);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    await submitSheet(async () => {
      await saveTemplate.mutateAsync({
        id: template.id,
        body: {
          name: name.trim(),
          type,
          groupId,
          category,
          accountId,
          memo: memo.trim() || null,
          amount: amountText === "" ? null : Number(amountText),
        },
      });
      toast("よく使う記録を直しました");
      onSaved?.(template.id);
    });
  }

  return (
    <ResponsiveSheet
      title="よく使う記録を直す"
      open={open}
      onOpenChange={close}
      onClose={handleClosed}
      footer={<SheetFooterActions formId={TEMPLATE_FORM_ID} busy={busy} canSubmit={canSubmit} onCancel={close} />}
    >
      <form id={TEMPLATE_FORM_ID} className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="名前">
          {(p) => <Input {...p} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="kakeibo-template-type-label">
            種類
          </span>
          <div className="flex gap-2" role="radiogroup" aria-labelledby="kakeibo-template-type-label">
            {(Object.keys(TEMPLATE_TYPE_LABELS) as KakeiboTemplateType[]).map((t) => (
              <Chip key={t} role="radio" aria-checked={type === t} onClick={() => changeType(t)}>
                {TEMPLATE_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2" id="kakeibo-template-category-label">
            カテゴリ
          </span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby="kakeibo-template-category-label">
            {categories.map((c) => (
              <Chip key={c.key} role="radio" aria-checked={category === c.key} onClick={() => setCategory(c.key)}>
                {c.label}
              </Chip>
            ))}
            {category !== null && (
              <Chip type="button" onClick={() => setCategory(null)}>
                カテゴリなし
              </Chip>
            )}
          </div>
        </div>
        <SharePickerRow groups={groups} me={me} value={groupId} onChange={changeGroup} extensionLabel="家計簿" />
        <AccountPickerRow
          label="口座"
          accounts={accountOptions}
          value={accountId}
          onChange={setAccountIdState}
          allowNone
          recordGroupId={splitCandidate ? groupId : null}
        />
        <Field label="金額" hint="省けます">
          {(p) => (
            <Input
              {...p}
              type="text"
              inputMode="decimal"
              pattern="[0-9]*"
              placeholder="省ける"
              value={amountText}
              onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
              className="text-right text-xl font-bold"
            />
          )}
        </Field>
        <Field label="メモ">
          {(p) => <Textarea {...p} value={memo} maxLength={200} onChange={(e) => setMemo(e.target.value)} />}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
      </form>
    </ResponsiveSheet>
  );
}
