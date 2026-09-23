import type { GroupSummary, Me } from "@shared/api-types";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, RotateCw, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { FieldMessage, PanelRow } from "@/components/parts/Panel";
import { ResponsiveSheet } from "@/components/parts/ResponsiveSheet";
import { SharePickerRow } from "@/components/parts/SharePicker";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import type { MemoryItem, MemoryRecord, Photo } from "../shared/types";
import { memoryKeys, useDeleteRecord, useInvalidateMemories, useSaveRecord } from "./api";
import { preparePhoto, uploadPhoto } from "./image";
import { PhotoImg } from "./parts";

/** 写真の欄の 1 つ。送っている途中か、送り終えたか、失敗したか */
type Slot =
  | { key: string; state: "sending"; preview: string; progress: number; file: File }
  | { key: string; state: "failed"; preview: string; error: string; file: File }
  | { key: string; state: "done"; photo: Photo };

const MAX_PHOTOS = 10;

/** `datetime-local` の値。端末の時間帯で書く */
function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * 記録のシート。写真を撮るか選び、文章を書き、グループと時刻を選んで残す。F-111、F-112、F-117
 *
 * 写真は選んだそばから 1 枚ずつ縮めて送り、進み具合を写真の上に出す。送り終えるまで「残す」は押せない。
 * 直すときは、書いた人だけが開ける。消すと 5 秒のあいだ元に戻せる。
 *
 * @param groups 思い出の拡張が有効なグループ
 * @param defaultGroupId 最初に選ぶグループ。無ければ自分だけ
 * @param wishes 済んだ印を付けられるやりたいこと。思い出の中で開いたときだけ
 * @param record 編集する記録。無ければ新しく作る
 * @param range 選べる時刻。思い出の日から開いたときは、その日の中で、いままで。無ければ、いままで
 */
export function RecordSheet({
  groups,
  me,
  defaultGroupId,
  wishes = [],
  record,
  range,
  onClose,
}: {
  groups: GroupSummary[];
  me: Me;
  defaultGroupId?: string | null;
  wishes?: MemoryItem[];
  record?: MemoryRecord;
  range?: { min: number; max: number };
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const invalidate = useInvalidateMemories();
  const saveRecord = useSaveRecord();
  const deleteRecord = useDeleteRecord();
  const personal = groups.find((g) => g.isPersonal);
  const [groupId, setGroupId] = useState(
    record?.groupId ??
      (groups.some((g) => g.id === defaultGroupId) ? defaultGroupId! : (personal?.id ?? groups[0]?.id ?? "")),
  );
  const [slots, setSlots] = useState<Slot[]>(() =>
    (record?.photos ?? []).map((p) => ({ key: p.id, state: "done" as const, photo: p })),
  );
  const [body, setBody] = useState(record?.body ?? "");
  const [time, setTime] = useState<string | null>(record ? toLocalInput(record.occurredAt) : null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const sending = slots.some((s) => s.state === "sending");
  const done = slots.filter((s): s is Extract<Slot, { state: "done" }> => s.state === "done");
  const firstTaken = done.map((s) => s.photo.takenAt).find((t): t is number => t !== null);
  const min = range?.min ?? null;
  const max = Math.min(range?.max ?? Date.now(), Date.now());
  const clamp = (t: number) => Math.min(Math.max(t, min ?? t), max);
  const shownTime = time ?? toLocalInput(clamp(firstTaken ?? Date.now()));
  const komaLocked = record?.kind === "koma";

  /** 1 枚を縮めて送る。失敗したら、その欄に理由を出し、押せば送り直せる */
  async function send(slotKey: string, file: File) {
    const update = (patch: Partial<Slot> & { state: Slot["state"] }) =>
      setSlots((all) => all.map((s) => (s.key === slotKey ? ({ ...s, ...patch } as Slot) : s)));
    try {
      const prepared = await preparePhoto(file);
      const token = await auth.currentUser?.getIdToken();
      const photo = await uploadPhoto(groupId, prepared, token, (progress) => update({ state: "sending", progress }));
      setSlots((all) => all.map((s) => (s.key === slotKey ? { key: slotKey, state: "done", photo } : s)));
    } catch (e) {
      update({ state: "failed", error: (e as Error).message });
    }
  }

  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - slots.length;
    const list = [...files].slice(0, Math.max(0, room));
    if (files.length > room) toast.error(`写真は 1 回に ${MAX_PHOTOS} 枚までです。`);
    const added = list.map((file) => ({
      key: crypto.randomUUID(),
      state: "sending" as const,
      preview: URL.createObjectURL(file),
      progress: 0,
      file,
    }));
    setSlots((all) => [...all, ...added]);
    for (const s of added) void send(s.key, s.file);
  }

  function retry(slot: Extract<Slot, { state: "failed" }>) {
    setSlots((all) => all.map((s) => (s.key === slot.key ? { ...slot, state: "sending", progress: 0 } : s)) as Slot[]);
    void send(slot.key, slot.file);
  }

  async function save() {
    setError(null);
    if (!body.trim() && done.length === 0) {
      setError("写真か文章を入力してください。");
      return;
    }
    const chosen = new Date(shownTime).getTime();
    if (chosen > Date.now() + 60_000) return setError("未来の時刻は選べません。");
    if (min !== null && (chosen < min || chosen > max)) return setError("この日の中の時刻を選んでください。");
    setSaving(true);
    const occurredAt = chosen;
    try {
      if (record) {
        await saveRecord.mutateAsync({
          id: record.id,
          body: { body: body.trim() || null, occurredAt, photoIds: done.map((s) => s.photo.id) },
        });
        toast("記録を保存しました");
      } else {
        await saveRecord.mutateAsync({
          body: { groupId, body: body.trim() || null, occurredAt, photoIds: done.map((s) => s.photo.id), itemId },
        });
        toast("記録しました");
      }
      await invalidate();
      onClose();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /** 消す。すぐ画面から外し、5 秒のあいだ「元に戻す」を出してから送る。F-117 */
  function remove() {
    if (!record) return;
    onClose();
    qc.setQueriesData<MemoryRecord[]>({ queryKey: ["memories", "records"] }, (old) =>
      old?.filter((r) => r.id !== record.id),
    );
    let undone = false;
    const timer = window.setTimeout(async () => {
      if (undone) return;
      try {
        await deleteRecord.mutateAsync(record.id);
      } catch (e) {
        toast.error((e as Error).message);
      }
      await invalidate();
    }, 5000);
    toast("記録を削除しました", {
      duration: 5000,
      action: {
        label: "元に戻す",
        onClick: () => {
          undone = true;
          window.clearTimeout(timer);
          void qc.invalidateQueries({ queryKey: memoryKeys.all });
        },
      },
    });
  }

  return (
    <ResponsiveSheet title={record ? "記録を編集" : "記録する"} onClose={onClose}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
      />
      <input
        ref={picker}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))}
      />

      {!komaLocked && (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => camera.current?.click()} disabled={slots.length >= MAX_PHOTOS}>
            <Camera className="size-5" />
            撮る
          </Button>
          <Button variant="secondary" onClick={() => picker.current?.click()} disabled={slots.length >= MAX_PHOTOS}>
            <ImagePlus className="size-5" />
            写真から選ぶ
          </Button>
        </div>
      )}

      {slots.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="選んだ写真">
          {slots.map((s, i) => (
            <li key={s.key} className="relative size-[72px] overflow-hidden rounded-xl">
              {s.state === "done" ? (
                <PhotoImg photo={s.photo} className="size-full" alt={`写真 ${i + 1}`} />
              ) : (
                <img
                  src={s.preview}
                  alt={`写真 ${i + 1}`}
                  className={cn("size-full object-cover", s.state === "failed" && "opacity-40")}
                />
              )}
              {s.state === "sending" && (
                <span
                  className="absolute inset-x-1.5 bottom-1.5 h-1 rounded-full bg-white/50"
                  role="progressbar"
                  aria-valuenow={Math.round(s.progress * 100)}
                  aria-label="送っています"
                >
                  <i
                    className="block h-full rounded-full bg-white"
                    style={{ width: `${Math.round(s.progress * 100)}%` }}
                  />
                </span>
              )}
              {s.state === "failed" && (
                <button
                  type="button"
                  className="absolute inset-0 grid place-items-center text-sun"
                  aria-label={`もう一度送る。${s.error}`}
                  title={s.error}
                  onClick={() => retry(s)}
                >
                  <RotateCw className="size-5" />
                </button>
              )}
              {!komaLocked && (
                <button
                  type="button"
                  aria-label={`写真 ${i + 1} を外す`}
                  className="absolute top-0.5 right-0.5 grid size-7 place-items-center rounded-full bg-black/55 text-white"
                  onClick={() => setSlots((all) => all.filter((x) => x.key !== s.key))}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Textarea
        aria-label="文章"
        placeholder={record?.kind === "koma" ? "ひとこと" : "できごとや、ひとこと"}
        value={body}
        maxLength={record?.kind === "koma" ? 40 : 1000}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-24"
      />

      <div>
        {!record && (
          <SharePickerRow
            groups={groups}
            me={me}
            value={groupId}
            onChange={setGroupId}
            disabled={slots.length > 0}
            disabledReason="写真を追加した後は、共有先を変えられません。"
          />
        )}
        <PanelRow>
          <label htmlFor="record-time">時刻</label>
          <input
            id="record-time"
            type="datetime-local"
            value={shownTime}
            min={min !== null ? toLocalInput(min) : undefined}
            max={toLocalInput(max)}
            onChange={(e) => setTime(e.target.value)}
            className="min-h-11 rounded-xl bg-transparent text-right text-sm font-bold"
          />
        </PanelRow>
        {!record && wishes.length > 0 && (
          <PanelRow>
            <label htmlFor="record-wish">できたやりたいこと</label>
            <select
              id="record-wish"
              value={itemId ?? ""}
              onChange={(e) => setItemId(e.target.value || null)}
              className="min-h-11 max-w-[60%] bg-transparent text-right text-sm"
            >
              <option value="">選ばない</option>
              {wishes.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
          </PanelRow>
        )}
      </div>
      {error && <FieldMessage error>{error}</FieldMessage>}

      <div className="flex gap-2">
        {record ? (
          <Button variant="danger" onClick={remove}>
            削除
          </Button>
        ) : (
          <Button variant="ghost" onClick={onClose}>
            やめる
          </Button>
        )}
        <Button className="flex-1" onClick={save} disabled={sending || saving}>
          {sending ? "写真を送っています" : "保存する"}
        </Button>
      </div>
    </ResponsiveSheet>
  );
}
