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
import { defaultShareGroupId } from "@/lib/share-default";
import { cn } from "@/lib/utils";
import type { MemoryItem, MemoryRecord, Photo } from "../shared/types";
import { memoryKeys, useDeleteRecord, useDiscardPhoto, useInvalidateMemories, useSaveRecord } from "./api";
import { preparePhoto, uploadPhoto } from "./image";
import { PhotoImg } from "./parts";

/** 写真の欄の 1 つ。送っている途中か、送り終えたか、失敗したか。fp は同じ写真を 2 回選んだのを見分ける印。#158 */
type Slot =
  | { key: string; state: "sending"; preview: string; progress: number; file: File; fp: string }
  | { key: string; state: "failed"; preview: string; error: string; file: File; fp: string }
  | { key: string; state: "done"; photo: Photo; fp: string };

const MAX_PHOTOS = 10;

/** 選んだ File を見分ける印。同じ写真を 2 回選んだかは、名前と大きさと更新時刻で見分ける。#158 */
function fingerprintOf(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

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
  const discardPhoto = useDiscardPhoto();
  const [groupId, setGroupId] = useState(
    record?.groupId ??
      defaultShareGroupId(groups, defaultGroupId, {
        groupId: me.settings.usualShareGroupId,
        extensionKey: "memories",
        alwaysOn: false,
      }),
  );
  // 新しく残すときだけ、いつもの共有先から選ばれたことが分かる印を出す。0063、F-40
  const usualDefault = !record && groupId === me.settings.usualShareGroupId;
  const [slots, setSlots] = useState<Slot[]>(() =>
    (record?.photos ?? []).map((p) => ({ key: p.id, state: "done" as const, photo: p, fp: p.id })),
  );
  const [body, setBody] = useState(record?.body ?? "");
  const [time, setTime] = useState<string | null>(record ? toLocalInput(record.occurredAt) : null);
  const [itemId, setItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  // このシートを開いてから新しく送った写真の ID。保存せずに外すか閉じたら、すぐ消す。F-117、#158
  const uploaded = useRef<Set<string>>(new Set());
  // 開いているか。閉じる動きは ResponsiveSheet に任せ、終わってから onClose を呼ぶ。#192
  const [open, setOpen] = useState(true);

  /** 保存に含めない、送った写真をすぐ消す */
  function discardUploaded(photoId: string) {
    if (!uploaded.current.delete(photoId)) return;
    discardPhoto.mutate(photoId);
  }

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
      uploaded.current.add(photo.id);
      setSlots((all) => all.map((s) => (s.key === slotKey ? { key: slotKey, state: "done", photo, fp: s.fp } : s)));
    } catch (e) {
      update({ state: "failed", error: (e as Error).message });
    }
  }

  /** 同じ写真を 2 回選んだら、2 回目は送らない。#158 */
  function addFiles(files: FileList | null) {
    if (!files) return;
    const room = MAX_PHOTOS - slots.length;
    const seen = new Set(slots.map((s) => s.fp));
    const picked: { file: File; fp: string }[] = [];
    let over = false;
    let dupe = false;
    for (const file of files) {
      const fp = fingerprintOf(file);
      if (seen.has(fp)) {
        dupe = true;
        continue;
      }
      if (picked.length >= room) {
        over = true;
        break;
      }
      seen.add(fp);
      picked.push({ file, fp });
    }
    if (over) toast.error(`写真は 1 回に ${MAX_PHOTOS} 枚までです。`);
    else if (dupe) toast.error("同じ写真は 1 回だけ選べます。");
    const added = picked.map(({ file, fp }) => ({
      key: crypto.randomUUID(),
      state: "sending" as const,
      preview: URL.createObjectURL(file),
      progress: 0,
      file,
      fp,
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
      // 送った写真は記録に付いたので、閉じるときにもう消さない
      uploaded.current.clear();
      await invalidate();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /** まだ記録に付いていない、送った写真をすべてすぐ消す */
  function discardAllUploaded() {
    for (const id of uploaded.current) discardPhoto.mutate(id);
    uploaded.current.clear();
  }

  /** 保存せずに閉じる。まだ記録に付いていない、送った写真はすぐ消す。F-117、#158 */
  function close() {
    discardAllUploaded();
    setOpen(false);
  }

  /** 消す。すぐ画面から外し、5 秒のあいだ「元に戻す」を出してから送る。F-117 */
  function remove() {
    if (!record) return;
    discardAllUploaded();
    setOpen(false);
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
    toast("記録を消しました", {
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
    <ResponsiveSheet
      title={record ? "記録を編集" : "記録する"}
      open={open}
      onOpenChange={close}
      onClose={onClose}
      footer={
        <div className="flex justify-between gap-2">
          {record ? (
            <Button variant="danger" onClick={remove}>
              消す
            </Button>
          ) : (
            <Button variant="ghost" onClick={close}>
              やめる
            </Button>
          )}
          <Button onClick={save} disabled={sending || saving}>
            {sending ? "写真を送っています" : "保存する"}
          </Button>
        </div>
      }
    >
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
                  onClick={() => {
                    // 外した写真が、まだ記録に付いていなければ、すぐ消す。F-117、#158
                    if (s.state === "done") discardUploaded(s.photo.id);
                    setSlots((all) => all.filter((x) => x.key !== s.key));
                  }}
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
        {/* 写真を選んだ後も共有先を変えられる。保存のとき、送った本人の写真だけを選んだ共有先に書き換える。#158 */}
        {!record && (
          <SharePickerRow
            groups={groups}
            me={me}
            value={groupId}
            onChange={setGroupId}
            usualDefault={usualDefault}
            extensionLabel="思い出"
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
    </ResponsiveSheet>
  );
}
