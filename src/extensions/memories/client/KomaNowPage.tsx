import { useQueryClient } from "@tanstack/react-query";
import { BellOff, Camera, ChevronLeft } from "lucide-react";
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { Loading } from "@/app/guards";
import { AppLayout } from "@/components/layout/AppLayout";
import { InitialAvatar } from "@/components/parts/Avatars";
import { LoadFailure } from "@/components/parts/Failure";
import { FieldMessage } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { memberColor } from "@/lib/colors";
import { auth } from "@/lib/firebase";
import { useMe } from "@/api/common";
import { poolColorsOf } from "@/modules/calendar/model";
import { useInvalidateMemories, useMemoryGroups } from "./api";
import { preparePhoto, uploadPhoto } from "./image";
import { deviceTimeZone, komaKeys, useKomaNow, useSaveKomaDay, useSaveKomaNow } from "./koma-api";
import { KomaLinkSheet } from "./KomaLinkSheet";
import { Ambient, PhotoImg } from "./parts";

/**
 * ひとコマを撮る。いまの枠に、写真 1 枚と一言を残す。F-121
 * 近道の帯と、端末の知らせから開く。今日を始めていなければ、始めるシートを出す。
 */
export function KomaNowPage() {
  const me = useMe();
  const { groups, ready } = useMemoryGroups();
  const now = useKomaNow();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const invalidate = useInvalidateMemories();
  const saveKomaNow = useSaveKomaNow();
  const saveKomaDay = useSaveKomaDay();
  const camera = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!me.data || !ready || now.isPending) return <Loading />;
  const data = now.data;
  const slot = data?.open[0] ?? null;
  const group = groups.find((g) => g.id === data?.groupId);
  const endsAt = slot ? new Date(slot.start + 3_600_000) : null;
  const minutesLeft = endsAt ? Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 60_000)) : 0;

  async function keep() {
    if (!preview || !slot || !data?.groupId) return;
    setSaving(true);
    setError(null);
    try {
      const prepared = await preparePhoto(preview.file);
      const photo = await uploadPhoto(data.groupId, prepared, await auth.currentUser?.getIdToken(), () => undefined);
      await saveKomaNow.mutateAsync({ photoId: photo.id, slot: slot.start, body: word.trim() || null });
      await Promise.all([invalidate(), qc.invalidateQueries({ queryKey: komaKeys.now })]);
      toast(`${slot.hour} 時のひとコマを保存しました`);
      navigate(data.memory ? `/memories/${data.memory.id}` : "/memories/koma", { replace: true });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function mute() {
    if (!data?.groupId) return;
    await saveKomaDay.mutateAsync({ day: data.day, groupId: data.groupId, memoryId: data.memory?.id ?? null, timeZone: deviceTimeZone(), muted: !data.muted });
    await qc.invalidateQueries({ queryKey: komaKeys.now });
    toast(data.muted ? "今日の通知をオンにしました" : "今日の通知をオフにしました");
  }

  return (
    <AppLayout poolColors={poolColorsOf(groups, me.data)}>
      <Ambient photo={data?.last ?? null} />
      <div className="flex w-full max-w-[560px] flex-col gap-3">
        <header className="glass flex min-h-[58px] items-center gap-1 rounded-full px-1.5 py-1.5">
          <Button asChild variant="ghost" size="icon">
            <Link to="/memories/koma" aria-label="ひとコマの確認へ">
              <ChevronLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{data?.memory?.title ?? "ひとコマ"}</h1>
          {data?.started && (
            <Button variant="ghost" size="sm" onClick={mute}>
              <BellOff className="size-4" />
              {data.muted ? "今日の通知をオン" : "今日の通知をオフ"}
            </Button>
          )}
        </header>
        {now.error && !now.data && <LoadFailure what="今日のひとコマ" error={now.error} onRetry={() => void now.refetch()} />}

        {!data?.started && (
          <section className="glass flex flex-col gap-3 rounded-panel p-5">
            <p className="text-sm leading-relaxed">今日のひとコマはまだ始めていません。始めると、7 時から 22 時台まで、1 時間に 1 枚ずつ写真を残せます。</p>
            <Button onClick={() => setStarting(true)}>今日のひとコマを始める</Button>
          </section>
        )}

        {data?.started && !slot && (
          <section className="glass rounded-panel p-5 text-sm leading-relaxed">ひとコマを撮れるのは 7 時から 22 時台までです。</section>
        )}

        {data?.started && slot && (
          <section className="glass flex flex-col gap-2 rounded-[30px] p-2">
            <div className="flex items-end gap-2 px-2.5 pt-2.5 pb-1 whitespace-nowrap">
              <span className="text-[64px] leading-[0.86] font-extrabold tracking-[-0.05em]">{slot.hour}</span>
              <span className="pb-1 text-[17px] font-extrabold">時のひとコマ</span>
              <span className="ml-auto pb-1 text-right text-xs leading-normal text-ink-2">
                <b className="block text-[13px] text-ink">あと {minutesLeft} 分</b>
                {endsAt && `${endsAt.getHours()}:00 まで`}
              </span>
            </div>
            <button
              type="button"
              className="relative grid min-h-[340px] place-items-center overflow-hidden rounded-[23px] bg-field"
              onClick={() => camera.current?.click()}
              aria-label={preview ? "撮り直す" : "撮る"}
            >
              {preview ? (
                <img src={preview.url} alt="撮った写真" className="absolute inset-0 size-full object-cover" />
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm font-bold text-ink-2">
                  <Camera className="size-8" />
                  {data.taken ? "撮り直す" : "撮る"}
                </span>
              )}
            </button>
            <Input value={word} maxLength={40} placeholder="ひとこと" aria-label="ひとこと" onChange={(e) => setWord(e.target.value)} />
            {data.others.length > 0 && (
              <ul className="flex flex-col gap-1.5 px-1.5 pb-1" aria-label="同じグループの人のひとコマ">
                {data.others.map((o) => {
                  const m = group?.members.find((x) => x.id === o.userId);
                  return (
                    <li key={o.userId} className="flex items-center gap-2 text-xs text-ink-2">
                      <PhotoImg photo={o.photo} className="h-10 w-[30px] flex-none rounded-lg" />
                      {m && <InitialAvatar person={{ id: m.id, name: m.name, color: memberColor(m.id, m.userColor, me.data.colorPrefs) }} />}
                      {m?.name ?? "メンバー"} が撮りました
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
        <input
          ref={camera}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setPreview({ url: URL.createObjectURL(file), file });
            e.target.value = "";
          }}
        />
        {error && <FieldMessage error>{error}</FieldMessage>}
        {data?.started && slot && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => camera.current?.click()}>
              <Camera className="size-5" />
              撮り直す
            </Button>
            <Button className="flex-1" disabled={!preview || saving} onClick={keep}>
              {saving ? "保存しています" : "保存する"}
            </Button>
          </div>
        )}
      </div>
      {starting && data && <KomaLinkSheet day={data.day} groups={groups} me={me.data} onClose={() => setStarting(false)} />}
    </AppLayout>
  );
}
