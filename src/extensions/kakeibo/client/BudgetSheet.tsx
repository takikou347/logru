/** 期間の予算を作る、直すシート。F-323 */
import type { GroupSummary, Me } from "@shared/api-types";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { Field } from "@/components/parts/Field";
import { LoadableSection, PanelSkeleton } from "@/components/parts/LoadableSection";
import { Empty, FieldMessage } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DAY_MS, dateKey, formatSpan } from "@/lib/dates";
import { defaultShareGroupId } from "@/lib/share-default";
import type { KakeiboBudget } from "./api";
import { useDeleteBudget, useKakeiboMemories, useSaveBudget } from "./api";
import { sanitizeAmountInput } from "./numeric-input";

/** 端末の時間帯。祝日や期間を表すのに使う */
const deviceTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Tokyo";

/** その月の終わりの日。予算の終わりの日の既定に使う。#196 */
function endOfMonthKey(d: Date): string {
  return dateKey(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/**
 * 「思い出から選ぶ」の一覧。選んだグループの思い出(期間のある項目)を、選ぶと名前と期間が入る。F-323
 * 土台のカレンダーの API だけを使い、思い出の表は読まない。0072
 */
function MemoryPickerSheet({
  groupId,
  onPick,
  onClose,
}: {
  groupId: string;
  onPick: (name: string, startDate: string, endDate: string) => void;
  onClose: () => void;
}) {
  // 前後およそ 1 年ぶんから選べれば、旅行など期間のある思い出はたいてい入る。0078、#196
  const memories = useKakeiboMemories(groupId);
  const tz = deviceTimeZone();

  return (
    <ResponsiveSheet title="思い出から選ぶ" onClose={onClose}>
      <LoadableSection query={memories} what="思い出" skeleton={<PanelSkeleton lines={4} />}>
        {(items) => {
          const sorted = [...items].sort((a, b) => b.startsAt - a.startsAt);
          return sorted.length === 0 ? (
            <Empty>このグループに、期間のある思い出がまだありません。</Empty>
          ) : (
            <ul className="flex flex-col">
              {sorted.map((m) => (
                <li key={m.id} className="border-line not-first:border-t">
                  <button
                    type="button"
                    className="flex min-h-12 w-full flex-col items-start gap-0.5 py-1.5 text-left"
                    onClick={() => {
                      const endsAt = m.endsAt ?? m.startsAt + DAY_MS;
                      onPick(m.title, dateKey(new Date(m.startsAt)), dateKey(new Date(endsAt - 1)));
                      onClose();
                    }}
                  >
                    <span className="min-w-0 truncate text-[15px] font-medium">{m.title}</span>
                    <span className="text-xs text-ink-2">
                      {formatSpan(m.startsAt, m.endsAt ?? m.startsAt + DAY_MS, tz)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          );
        }}
      </LoadableSection>
    </ResponsiveSheet>
  );
}

/**
 * 期間の予算を作る、直すシート。グループ、名前、始まりの日、終わりの日、金額を入れる。
 * 「思い出から選ぶ」で、そのグループの思い出を選ぶと、名前と期間が入る。F-323
 */
export function BudgetSheet({
  groups,
  me,
  budget,
  defaultGroupId,
  onClose,
}: {
  groups: GroupSummary[];
  me: Me;
  budget?: KakeiboBudget;
  defaultGroupId?: string | null;
  onClose: () => void;
}) {
  const saveBudget = useSaveBudget();
  const deleteBudget = useDeleteBudget();

  const [groupId, setGroupId] = useState(
    budget?.groupId ??
      defaultShareGroupId(groups, defaultGroupId, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "kakeibo",
        alwaysOn: false,
      }),
  );
  const [name, setName] = useState(budget?.name ?? "");
  const [startDate, setStartDate] = useState(budget?.startDate ?? dateKey(new Date()));
  // 終わりの日の既定は月末。旅行のように月をまたぐ予算は、始まりの日を変えれば追いつく。#196
  const [endDate, setEndDate] = useState(budget?.endDate ?? endOfMonthKey(new Date()));
  const [amountText, setAmountText] = useState(budget ? String(budget.amount) : "");
  const [pickingMemory, setPickingMemory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const amountValue = Number(amountText);
  const amountOk = amountText !== "" && Number.isInteger(amountValue) && amountValue > 0 && amountValue <= 100_000_000;
  const canSubmit =
    name.trim().length > 0 && name.trim().length <= 30 && Boolean(groupId) && endDate >= startDate && amountOk;

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!canSubmit) return;
    setBusy(true);
    try {
      if (budget) {
        await saveBudget.mutateAsync({
          id: budget.id,
          body: { name: name.trim(), startDate, endDate, amount: amountValue },
        });
        toast("予算を直しました");
      } else {
        await saveBudget.mutateAsync({ body: { groupId, name: name.trim(), startDate, endDate, amount: amountValue } });
        toast("予算を作りました");
      }
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  async function remove() {
    if (!budget) return;
    setBusy(true);
    try {
      await deleteBudget.mutateAsync(budget.id);
      toast("予算を消しました");
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet title={budget ? "予算を直す" : "予算を作る"} onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        {!budget && (
          <SharePickerRow groups={groups} me={me} value={groupId} onChange={setGroupId} extensionLabel="家計簿" />
        )}
        {!budget && groupId && (
          <Button type="button" variant="secondary" onClick={() => setPickingMemory(true)}>
            思い出から選ぶ
          </Button>
        )}
        <Field label="名前">
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={name}
              maxLength={30}
              placeholder="9月の生活費、箱根旅行"
              onChange={(e) => setName(e.target.value)}
            />
          )}
        </Field>
        <Field label="始まりの日">
          {(p) => (
            <Input
              {...p}
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (endDate < e.target.value) setEndDate(e.target.value);
              }}
            />
          )}
        </Field>
        <Field label="終わりの日">
          {(p) => (
            <Input {...p} type="date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
          )}
        </Field>
        <Field label="金額">
          {(p) => (
            <Input
              {...p}
              type="text"
              inputMode="numeric"
              value={amountText}
              onChange={(e) => setAmountText(sanitizeAmountInput(e.target.value))}
              className="text-right"
            />
          )}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex justify-between gap-2">
          {budget ? (
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
      {pickingMemory && groupId && (
        <MemoryPickerSheet
          groupId={groupId}
          onClose={() => setPickingMemory(false)}
          onPick={(pickedName, pickedStart, pickedEnd) => {
            setName(pickedName);
            setStartDate(pickedStart);
            setEndDate(pickedEnd);
          }}
        />
      )}
    </ResponsiveSheet>
  );
}
