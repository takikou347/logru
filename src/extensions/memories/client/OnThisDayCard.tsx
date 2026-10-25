/**
 * 今日のページの思い出の節に出す、何年か前の今日の札。F-132、0100
 *
 * 伏せた札を押すと裏返り、写真と文章の頭が出る。もう一度押すと、その日を見返す画面(F-113)へ移る。
 * 端末の傾きで数度だけ傾く(夜空の星の視差 0095 と同じ useDeviceTilt)。動きを減らすときは、
 * 裏返しをクロスフェードにし、傾きも止める。写真が無い年、今日以外を見ているときは出さない。
 */
import { CalendarHeart, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { FlipCard } from "@/components/parts/FlipCard";
import { dateKey } from "@/lib/dates";
import { vibrateFlip } from "@/lib/haptics";
import { useDeviceTilt } from "@/lib/use-device-tilt";
import { useMediaQuery } from "@/lib/use-media-query";
import { useOnThisDay } from "./api";
import { PhotoImg } from "./parts";

/** 傾き(px、最大 6)を札の角度にする倍率。最大でおよそ 4 度 */
const TILT_DEG_PER_PX = 0.66;

export function OnThisDayCard({ date, isToday }: { date: Date; isToday: boolean }) {
  const day = dateKey(date);
  const { data } = useOnThisDay(day, isToday);
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(pointer: coarse)");
  // 裏返した日を覚える。開いたまま日が変わると、次の日の札は伏せた状態で出る
  const [flippedDay, setFlippedDay] = useState<string | null>(null);
  const flipped = flippedDay === day;
  const { offset, requestOnce } = useDeviceTilt(touch && !reduced);
  if (!isToday || !data) return null;
  const photo = data.record.photos[0];
  if (!photo) return null;
  const label = `${data.yearsAgo}年前の今日`;

  return (
    <FlipCard
      className="mb-2 h-44"
      flipped={flipped}
      reduced={reduced}
      tiltX={-offset.y * TILT_DEG_PER_PX}
      tiltY={offset.x * TILT_DEG_PER_PX}
      front={
        <button
          type="button"
          data-testid="on-this-day-front"
          aria-label={`${label}の写真をめくる`}
          onClick={() => {
            requestOnce();
            vibrateFlip();
            setFlippedDay(day);
          }}
          className="flex size-full flex-col items-center justify-center gap-2 border border-line bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-ink"
        >
          <CalendarHeart className="size-7 text-ink-2" aria-hidden="true" />
          <span className="text-base font-bold">{label}</span>
          <span className="text-xs text-ink-2">押すとめくれます</span>
        </button>
      }
      back={
        <Link
          to={`/memories/on/${data.day}`}
          data-testid="on-this-day-back"
          aria-label={`${label}を見返す`}
          className="relative block size-full text-white no-underline"
        >
          <PhotoImg photo={photo} size="large" className="absolute inset-0 [&_img]:object-cover" />
          <span className="absolute inset-x-0 bottom-0 flex items-end gap-2 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-3.5 pt-12 pb-3">
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-bold">{label}</span>
              {data.record.body && <span className="line-clamp-2 text-sm leading-snug">{data.record.body}</span>}
            </span>
            <span className="flex flex-none items-center text-xs">
              見返す
              <ChevronRight className="size-4" aria-hidden="true" />
            </span>
          </span>
        </Link>
      }
    />
  );
}
