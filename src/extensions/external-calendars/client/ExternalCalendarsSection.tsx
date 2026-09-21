import { useMutation, useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { toast } from "sonner";
import { GROUP_COLORS, type GroupColor } from "../../../shared/colors";
import { ColorSwatches } from "@/components/ColorSwatches";
import { Field } from "@/components/Field";
import { Dot, Empty, FieldMessage, Panel } from "@/components/Panel";
import { ResponsiveSheet } from "@/components/ResponsiveSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import type { ExternalCalendarSummary } from "../shared/schemas";
import { EXTERNAL_CALENDARS_KEY as KEY, useExternalCalendars } from "./queries";

/** `9月21日 14:05` の形にする */
function formatSynced(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 設定の画面の「外部のカレンダー」の欄。
 * Google カレンダーの非公開の URL を登録すると、その予定を自分のカレンダーに出す。読むだけ。
 */
export function ExternalCalendarsSection() {
  const qc = useQueryClient();
  const calendars = useExternalCalendars();
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ExternalCalendarSummary | null>(null);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: KEY }), qc.invalidateQueries({ queryKey: ["calendar"] })]);

  const resync = useMutation({
    mutationFn: (id: string) => api<ExternalCalendarSummary>(`/external-calendars/${id}/sync`, { method: "POST" }),
    onSuccess: (c) => (c.lastError ? toast.error(c.lastError) : toast(`${c.name} を読み直しました`)),
    onError: (e) => toast.error((e as Error).message),
    onSettled: refresh,
  });

  const list = calendars.data ?? [];
  return (
    <Panel title="外部のカレンダー">
      <FieldMessage>Google カレンダーの予定を、自分のカレンダーに出します。読むだけで、ほかの人には見えません。5 分おきに読み直します。カレンダーの画面の読み直しのボタンでも、すぐに読めます。</FieldMessage>
      {calendars.error && <FieldMessage error>{calendars.error.message}</FieldMessage>}
      {calendars.isSuccess && list.length === 0 && <Empty>まだ登録していません。</Empty>}
      {list.length > 0 && (
        <ul aria-label="登録した外部のカレンダー">
          {list.map((c) => (
            <li key={c.id} className="flex flex-col gap-1.5 border-b border-line py-2.5 last:border-b-0">
              <div className="flex min-w-0 items-center gap-2.5">
                <Dot color={c.color} className="size-3" />
                <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{c.name}</span>
                <span className="flex-none text-xs text-ink-2">{c.host}</span>
              </div>
              {c.lastError ? (
                <FieldMessage error>{c.lastError}</FieldMessage>
              ) : (
                <FieldMessage>{c.lastSyncedAt ? `${formatSynced(c.lastSyncedAt)} に読みました` : "まだ読んでいません"}</FieldMessage>
              )}
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={resync.isPending && resync.variables === c.id}
                  onClick={() => resync.mutate(c.id)}
                  aria-label={`${c.name} を今すぐ読み直す`}
                >
                  {resync.isPending && resync.variables === c.id ? "読んでいます" : "今すぐ読み直す"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setRemoving(c)} aria-label={`${c.name} の登録を消す`}>
                  登録を消す
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" className="self-start" onClick={() => setAdding(true)}>
        カレンダーを登録する
      </Button>

      {adding && <AddCalendarSheet used={list.map((c) => c.color)} onClose={() => setAdding(false)} onAdded={refresh} />}
      {removing && <RemoveCalendarSheet calendar={removing} onClose={() => setRemoving(null)} onRemoved={refresh} />}
    </Panel>
  );
}

/** 外部のカレンダーを登録するシート。名前、色、URL を聞く */
function AddCalendarSheet({ used, onClose, onAdded }: { used: string[]; onClose: () => void; onAdded: () => Promise<unknown> }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<GroupColor>(() => GROUP_COLORS.find((c) => !used.includes(c.key))?.key ?? "asagi");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const saved = await api<ExternalCalendarSummary>("/external-calendars", { method: "POST", body: { name, color, url } });
      await onAdded();
      if (saved.lastError) toast.error(`登録しましたが、読めませんでした。${saved.lastError}`);
      else toast(`${saved.name} を登録しました`);
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <ResponsiveSheet title="外部のカレンダーを登録する" onClose={onClose}>
      <form className="flex flex-col gap-3.5" onSubmit={submit} noValidate>
        <Field label="名前" hint="カレンダーの予定の横に出ます。">
          {(p) => <Input {...p} value={name} maxLength={40} placeholder="例: プライベート" onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">色</span>
          <ColorSwatches label="カレンダーの色" value={color} options={GROUP_COLORS} onChange={(v) => setColor(v as GroupColor)} />
        </div>
        <Field
          label="iCal 形式の非公開 URL"
          hint="Google カレンダーをパソコンで開き、「設定」から該当のカレンダーを選び、「カレンダーの統合」にある「iCal 形式の非公開 URL」をコピーして貼ります。この URL を知る人は予定を見られるので、ほかの人に教えないでください。"
        >
          {(p) => (
            <Input
              {...p}
              type="url"
              inputMode="url"
              autoComplete="off"
              value={url}
              placeholder="https://calendar.google.com/calendar/ical/…/basic.ics"
              onChange={(e) => setUrl(e.target.value)}
            />
          )}
        </Field>
        {error && <FieldMessage error>{error}</FieldMessage>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            やめる
          </Button>
          <Button type="submit" disabled={busy || !name.trim() || !url.trim()}>
            {busy ? "読んでいます" : "登録する"}
          </Button>
        </div>
      </form>
    </ResponsiveSheet>
  );
}

/** 登録を消す前の確認。消すと、取り込んだ予定も消える */
function RemoveCalendarSheet({
  calendar,
  onClose,
  onRemoved,
}: {
  calendar: ExternalCalendarSummary;
  onClose: () => void;
  onRemoved: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try {
      await api(`/external-calendars/${calendar.id}`, { method: "DELETE" });
      await onRemoved();
      toast(`${calendar.name} の登録を消しました`);
      onClose();
    } catch (err) {
      toast.error((err as Error).message);
      setBusy(false);
    }
  }
  return (
    <ResponsiveSheet
      title={`${calendar.name} の登録を消す`}
      description="取り込んだ予定も、Logru から消えます。Google カレンダーの予定は消えません。"
      onClose={onClose}
    >
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          やめる
        </Button>
        <Button type="button" variant="danger" disabled={busy} onClick={remove}>
          登録を消す
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
