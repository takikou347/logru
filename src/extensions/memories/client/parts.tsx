/** 思い出の画面で使い回す部品。見た目は 0024 */

import type { GroupSummary, Me } from "@shared/api-types";
import { Heart } from "lucide-react";
import { type ReactNode, useState } from "react";
import { personOf, UserAvatar, UserAvatarStack } from "@/components/parts/Avatars";
import { Dot } from "@/components/parts/Panel";
import { groupColor } from "@/lib/colors";
import { vibrateShort } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import type { MemoryRecord, Photo } from "../shared/types";
import { useLike } from "./api";

/**
 * 写真。読み込むまでは 32 px の写真を広げて出し、画面に入ってから本物を読む。0024
 * @param size thumb は一覧、full は大きく見る画面
 */
export function PhotoImg({
  photo,
  size = "thumb",
  className,
  alt = "",
}: {
  photo: Photo;
  size?: "thumb" | "full";
  className?: string;
  alt?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span
      className={cn("relative block overflow-hidden bg-cover bg-center", className)}
      style={{ backgroundImage: `url(${photo.tiny})` }}
    >
      <img
        src={size === "full" ? photo.fullUrl : photo.thumbUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn("size-full object-cover transition-opacity duration-300", loaded ? "opacity-100" : "opacity-0")}
      />
    </span>
  );
}

/**
 * 表紙の写真を、画面の奥に広げて置く。インクだまりの代わり。0024
 * 32 px の写真を画面いっぱいに広げると、それだけでぼける。濃さはインクだまりと同じ。
 */
export function Ambient({ photo }: { photo: Photo | null }) {
  if (!photo) return null;
  return (
    <div
      aria-hidden="true"
      data-ambient
      className="pointer-events-none fixed -inset-20 -z-10 bg-cover bg-center opacity-(--pool-opacity)"
      style={{ backgroundImage: `url(${photo.tiny})`, filter: "saturate(130%)" }}
    />
  );
}

/** 記録を書いた人。名前・色・アイコンの URL は personOf が引く。グループにいなければ「退会した人」。#152 */
export function authorOf(record: MemoryRecord, groups: GroupSummary[], me: Me) {
  return personOf(record.createdBy ?? "gone", groups, me);
}

/**
 * いいねのボタン。付けると朱にする。横に付けた人の頭文字を重ねる。F-116
 * 付けた瞬間だけ、ハートが一度はねて、端末が短く震える。動かすのは transform と opacity だけ。0044、0048、#98、#112
 */
function LikeButton({ record, groups, me }: { record: MemoryRecord; groups: GroupSummary[]; me: Me }) {
  const like = useLike();
  const on = record.likes.includes(me.user.id);
  const [bounce, setBounce] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-pressed={on}
        aria-label={on ? `いいねを外す。いま ${record.likes.length}` : `いいねを付ける。いま ${record.likes.length}`}
        onClick={() => {
          const next = !on;
          like.mutate({ record, on: next, me: me.user.id });
          if (next) {
            setBounce(true);
            vibrateShort();
          }
        }}
        className={cn(
          "inline-flex min-h-9 items-center gap-1.5 rounded-full border border-line pr-3 pl-2.5 text-[13px] font-bold text-ink-2",
          on &&
            "border-[color-mix(in_srgb,var(--sun)_35%,transparent)] bg-[color-mix(in_srgb,var(--sun)_10%,transparent)] text-sun",
        )}
      >
        <Heart
          className={cn("size-4", on && "fill-current", bounce && "heart-bounce")}
          onAnimationEnd={() => setBounce(false)}
          aria-hidden="true"
        />
        {record.likes.length}
      </button>
      {record.likes.length > 0 && <UserAvatarStack userIds={record.likes} groups={groups} me={me} size={20} />}
    </div>
  );
}

/** 記録の写真の並べ方。1 枚は大きく、2 枚は並べ、3 枚以上は左を大きく */
function PhotoGrid({ photos, onOpen, big = false }: { photos: Photo[]; onOpen?: (p: Photo) => void; big?: boolean }) {
  if (photos.length === 0) return null;
  const shown = photos.slice(0, 3);
  const rest = photos.length - shown.length;
  const cell = (p: Photo, i: number, cls: string) => (
    <button
      key={p.id}
      type="button"
      className={cn("relative block", cls)}
      onClick={() => onOpen?.(p)}
      aria-label={`写真 ${i + 1} を大きく見る`}
    >
      <PhotoImg photo={p} className="size-full" />
      {rest > 0 && i === shown.length - 1 && (
        <span className="absolute inset-0 grid place-items-center bg-black/40 text-lg font-bold text-white">
          +{rest}
        </span>
      )}
    </button>
  );
  if (shown.length === 1)
    return (
      <div className="overflow-hidden rounded-[17px]">
        {cell(shown[0]!, 0, cn("w-full", big ? "h-[300px]" : "h-[196px]"))}
      </div>
    );
  if (shown.length === 2) {
    return (
      <div className="grid grid-cols-2 gap-[3px] overflow-hidden rounded-[17px]">
        {shown.map((p, i) => cell(p, i, big ? "h-[180px]" : "h-[124px]"))}
      </div>
    );
  }
  return (
    <div
      className={cn(
        "grid grid-cols-[2fr_1fr] gap-[3px] overflow-hidden rounded-[17px]",
        big ? "grid-rows-[130px_130px]" : "grid-rows-[88px_88px]",
      )}
    >
      {cell(shown[0]!, 0, "row-span-2")}
      {cell(shown[1]!, 1, "")}
      {cell(shown[2]!, 2, "")}
    </div>
  );
}

/**
 * 記録 1 件。写真、書いた人、文章、いいね。書いた人は押して直せる。
 * @param onEdit 自分の記録を押したとき
 */
export function RecordBody({
  record,
  groups,
  me,
  onOpenPhoto,
  onEdit,
  big,
}: {
  record: MemoryRecord;
  groups: GroupSummary[];
  me: Me;
  onOpenPhoto?: (p: Photo) => void;
  onEdit?: (r: MemoryRecord) => void;
  big?: boolean;
}) {
  const author = authorOf(record, groups, me);
  const mine = record.createdBy === me.user.id;
  return (
    <article className="flex flex-col gap-1 py-2" aria-label={`${author.name} の記録`}>
      <PhotoGrid photos={record.photos} onOpen={onOpenPhoto} big={big} />
      <div className="flex items-center gap-1.5 pt-1.5 text-xs font-bold">
        <UserAvatar userId={author.id} groups={groups} me={me} size={22} />
        {author.name}
        {record.kind === "koma" && (
          <span className="rounded-full bg-field px-1.5 text-[10px] text-ink-2">ひとコマ</span>
        )}
        {mine && onEdit && (
          <button
            type="button"
            className="ml-auto min-h-8 px-2 text-xs font-medium text-ink-2"
            onClick={() => onEdit(record)}
          >
            編集
          </button>
        )}
      </div>
      {record.body && <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{record.body}</p>}
      <LikeButton record={record} groups={groups} me={me} />
    </article>
  );
}

/** グループの名前と色の点。自分だけのグループは「自分だけ」 */
export function GroupLabel({ group, me, children }: { group: GroupSummary | undefined; me: Me; children?: ReactNode }) {
  if (!group) return null;
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-ink-2">
      <Dot color={groupColor(group, me.colorPrefs)} />
      <span className="truncate">
        {group.isPersonal ? "自分だけ" : group.name}
        {children}
      </span>
    </span>
  );
}

/** 期間の見出し。`9.19 土 — 9.20 日` */
export function formatSpan(startsAt: number, endsAt: number, timeZone: string): string {
  const f = new Intl.DateTimeFormat("ja-JP", { timeZone, month: "numeric", day: "numeric", weekday: "short" });
  const a = f.formatToParts(startsAt);
  const b = f.formatToParts(endsAt - 1);
  const s = (p: Intl.DateTimeFormatPart[]) =>
    `${p.find((x) => x.type === "month")?.value}.${p.find((x) => x.type === "day")?.value} ${p.find((x) => x.type === "weekday")?.value}`;
  const first = s(a);
  const last = s(b);
  return first === last ? first : `${first} — ${last}`;
}

/** 時刻。`14:08` */
export function formatClock(ms: number, timeZone?: string): string {
  return new Intl.DateTimeFormat("ja-JP", { timeZone, hour: "numeric", minute: "2-digit" }).format(ms);
}
