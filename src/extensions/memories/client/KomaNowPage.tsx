import { useQueryClient } from "@tanstack/react-query";
import { BellOff, Camera, ChevronLeft } from "lucide-react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { toast } from "sonner";
import { useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { AppLayout } from "@/components/layout/AppLayout";
import { UserAvatar } from "@/components/parts/Avatars";
import { LoadFailure } from "@/components/parts/Failure";
import { FieldMessage } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { auth } from "@/lib/firebase";
import { useBack } from "@/lib/use-back";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "@/modules/calendar/model";
import { useInvalidateMemories, useMemoryGroups } from "./api";
import { preparePhoto, uploadPhoto } from "./image";
import { KomaLinkSheet } from "./KomaLinkSheet";
import { deviceTimeZone, komaKeys, useKomaNow, useSaveKomaDay, useSaveKomaNow } from "./koma-api";
import { prefersReducedMotion } from "./motion";
import { Ambient, PhotoImg } from "./parts";

/** 現像に見せる時間。1.2 秒。#101 */
const DEVELOP_MS = 1200;
/** 印へ吸い込まれる時間。0044 の --dur-slow と同じ */
const ABSORB_MS = 320;

/** 保存した後、現像してから移る先へ届けるまでの状態 */
type Deliver = { dest: string; phase: "developing" | "pinned" | "absorbing" };
/** 写真から印までの、飛ぶ距離と出発点 */
type Fly = { top: number; left: number; width: number; height: number; dx: number; dy: number };

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
  const goBack = useBack("/memories/koma");
  const invalidate = useInvalidateMemories();
  const saveKomaNow = useSaveKomaNow();
  const saveKomaDay = useSaveKomaDay();
  const camera = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLButtonElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<{ url: string; file: File } | null>(null);
  const [word, setWord] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [starting, setStarting] = useState(false);
  const [deliver, setDeliver] = useState<Deliver | null>(null);
  const [fly, setFly] = useState<Fly | null>(null);

  // 現像を見せ終えたら、写真から今日のしおりの印までの距離を測り、吸い込む段へ進む。#101
  useEffect(() => {
    if (deliver?.phase !== "developing") return;
    const timer = window.setTimeout(() => {
      const photoRect = photoRef.current?.getBoundingClientRect();
      const markRect = markRef.current?.getBoundingClientRect();
      if (photoRect && markRect) {
        setFly({
          top: photoRect.top,
          left: photoRect.left,
          width: photoRect.width,
          height: photoRect.height,
          dx: markRect.left + markRect.width / 2 - (photoRect.left + photoRect.width / 2),
          dy: markRect.top + markRect.height / 2 - (photoRect.top + photoRect.height / 2),
        });
      }
      setDeliver((d) => (d ? { ...d, phase: "pinned" } : d));
    }, DEVELOP_MS);
    return () => window.clearTimeout(timer);
  }, [deliver?.phase]);

  // 固定した位置で 1 フレーム待ってから transform を掛け、CSS の transition を効かせる
  useEffect(() => {
    if (deliver?.phase !== "pinned") return;
    const frame = requestAnimationFrame(() => setDeliver((d) => (d ? { ...d, phase: "absorbing" } : d)));
    return () => cancelAnimationFrame(frame);
  }, [deliver?.phase]);

  useEffect(() => {
    if (deliver?.phase !== "absorbing") return;
    const timer = window.setTimeout(() => navigate(deliver.dest, { replace: true }), ABSORB_MS);
    return () => window.clearTimeout(timer);
  }, [deliver, navigate]);

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
      const dest = data.memory ? `/memories/${data.memory.id}` : "/memories/koma";
      // 動きを減らす設定では、現像も吸い込みもせずすぐに出す。#101
      if (prefersReducedMotion()) {
        navigate(dest, { replace: true });
        return;
      }
      setDeliver({ dest, phase: "developing" });
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  }

  async function mute() {
    if (!data?.groupId) return;
    await saveKomaDay.mutateAsync({
      day: data.day,
      groupId: data.groupId,
      memoryId: data.memory?.id ?? null,
      timeZone: deviceTimeZone(),
      muted: !data.muted,
    });
    await qc.invalidateQueries({ queryKey: komaKeys.now });
    toast(data.muted ? "今日の通知をオンにしました" : "今日の通知をオフにしました");
  }

  return (
    <AppLayout poolColors={poolColorsOf(groups, me.data)}>
      <Ambient photo={data?.last ?? null} />
      <div className="flex w-full max-w-[560px] flex-col gap-3">
        <header className="glass flex min-h-[58px] items-center gap-1 rounded-full px-1.5 py-1.5">
          <Button asChild variant="ghost" size="icon">
            <Link to={goBack.to} aria-label="ひとコマの確認へ" onClick={goBack.onClick}>
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
        {now.error && !now.data && (
          <LoadFailure what="今日のひとコマ" error={now.error} onRetry={() => void now.refetch()} />
        )}

        {!data?.started && (
          <section className="glass flex flex-col gap-3 rounded-panel p-5">
            <p className="text-sm leading-relaxed">
              今日のひとコマはまだ始めていません。始めると、7 時から 22 時台まで、1 時間に 1 枚ずつ写真を残せます。
            </p>
            <Button onClick={() => setStarting(true)}>今日のひとコマを始める</Button>
          </section>
        )}

        {data?.started && !slot && (
          <section className="glass rounded-panel p-5 text-sm leading-relaxed">
            ひとコマを撮れるのは 7 時から 22 時台までです。
          </section>
        )}

        {data?.started && slot && (
          <section className="glass relative flex flex-col gap-2 rounded-[30px] p-2">
            {/* 今日のしおりの印。現像した写真は、ここへ小さく吸い込まれる。0024 の「いまの枠」と同じ形。#101 */}
            <span
              ref={markRef}
              aria-hidden="true"
              className="absolute -top-px left-6 h-[18px] w-[14px] bg-primary [clip-path:polygon(0_0,100%_0,100%_100%,50%_78%,0_100%)]"
            />
            <div className="flex items-end gap-2 px-2.5 pt-2.5 pb-1 whitespace-nowrap">
              <span className="text-[64px] leading-[0.86] font-extrabold tracking-[-0.05em]">{slot.hour}</span>
              <span className="pb-1 text-[17px] font-extrabold">時のひとコマ</span>
              <span className="ml-auto pb-1 text-right text-xs leading-normal text-ink-2">
                <b className="block text-[13px] text-ink">あと {minutesLeft} 分</b>
                {endsAt && `${endsAt.getHours()}:00 まで`}
              </span>
            </div>
            <button
              ref={photoRef}
              type="button"
              disabled={Boolean(deliver)}
              className={cn(
                "relative grid min-h-[340px] place-items-center overflow-hidden rounded-[23px] bg-field",
                deliver?.phase === "developing" && "koma-developing",
                deliver?.phase === "absorbing" && "transition-[transform,opacity] duration-slow ease-out",
              )}
              style={
                fly && deliver && deliver.phase !== "developing"
                  ? ({
                      position: "fixed",
                      top: fly.top,
                      left: fly.left,
                      width: fly.width,
                      height: fly.height,
                      zIndex: 60,
                      transform:
                        deliver.phase === "absorbing" ? `translate(${fly.dx}px, ${fly.dy}px) scale(0.05)` : "none",
                      opacity: deliver.phase === "absorbing" ? 0 : 1,
                    } as CSSProperties)
                  : undefined
              }
              onClick={() => !deliver && camera.current?.click()}
              aria-label={preview ? "撮り直す" : "撮る"}
            >
              {preview ? (
                <>
                  <img src={preview.url} alt="撮った写真" className="absolute inset-0 size-full object-cover" />
                  {/* 白から色づく現像の白い幕。opacity だけを動かす。#101 */}
                  {deliver?.phase === "developing" && (
                    <span aria-hidden="true" className="koma-veil absolute inset-0 bg-white" />
                  )}
                </>
              ) : (
                <span className="flex flex-col items-center gap-2 text-sm font-bold text-ink-2">
                  <Camera className="size-8" />
                  {data.taken ? "撮り直す" : "撮る"}
                </span>
              )}
            </button>
            <Input
              value={word}
              maxLength={40}
              placeholder="ひとこと"
              aria-label="ひとこと"
              onChange={(e) => setWord(e.target.value)}
            />
            {data.others.length > 0 && (
              <ul className="flex flex-col gap-1.5 px-1.5 pb-1" aria-label="同じグループの人のひとコマ">
                {data.others.map((o) => {
                  const m = group?.members.find((x) => x.id === o.userId);
                  return (
                    <li key={o.userId} className="flex items-center gap-2 text-xs text-ink-2">
                      <PhotoImg photo={o.photo} className="h-10 w-[30px] flex-none rounded-lg" />
                      {m && <UserAvatar userId={m.id} groups={groups} me={me.data} />}
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
            <Button variant="secondary" disabled={Boolean(deliver)} onClick={() => camera.current?.click()}>
              <Camera className="size-5" />
              撮り直す
            </Button>
            <Button className="flex-1" disabled={!preview || saving} onClick={keep}>
              {saving ? "保存しています" : "保存する"}
            </Button>
          </div>
        )}
      </div>
      {starting && data && (
        <KomaLinkSheet day={data.day} groups={groups} me={me.data} onClose={() => setStarting(false)} />
      )}
    </AppLayout>
  );
}
