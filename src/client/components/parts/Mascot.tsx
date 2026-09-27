/**
 * 空の画面のマスコット「メクリ」。3D のフィギュアの画像を出す。0053、#179
 *
 * 画像は、kota が ChatGPT で作った 8 つのポーズを、透明な WebP に 1 枚ずつ切り出したもの。
 * 色は決まっている(体は生成り、リボンは緑)。ライトとダークのどちらの地でも浮かないことを確かめた。
 * 絵は飾りなので alt を空にし、読み上げでは読ませない。読み上げは EmptyState の文とボタンだけに聞こえる。
 * 動きは、ゆっくり上下にゆれるだけ。動きを減らす設定では止める(globals.css の mascot-bob)。
 */
import bell from "@/assets/mascot/mekuri-bell.webp";
import calendar from "@/assets/mascot/mekuri-calendar.webp";
import camera from "@/assets/mascot/mekuri-camera.webp";
import coin from "@/assets/mascot/mekuri-coin.webp";
import compass from "@/assets/mascot/mekuri-compass.webp";
import sad from "@/assets/mascot/mekuri-sad.webp";
import search from "@/assets/mascot/mekuri-search.webp";
import wave from "@/assets/mascot/mekuri-wave.webp";
import { cn } from "@/lib/utils";

export type MascotPose = "calendar" | "camera" | "coin" | "compass" | "bell" | "search" | "list" | "sad" | "wave";

/** ポーズごとの画像。共有リストは、紙を持つ「calendar」の絵を使い回す */
const SOURCES: Record<MascotPose, string> = {
  calendar,
  camera,
  coin,
  compass,
  bell,
  search,
  list: calendar,
  sad,
  wave,
};

/** 画面で使うポーズの一覧。見本の画面が並べるのに使う */
export const MASCOT_POSES = Object.keys(SOURCES) as MascotPose[];

/**
 * メクリ。`pose` で持ち物と表情を変える。
 * @param pose 出すポーズ。空の画面ごとに変える
 * @param size 一辺の大きさ(px)。画像は 256px で持つので、2 倍の密度の画面でも 128px まではにじまない
 */
export function Mascot({ pose, size = 88, className }: { pose: MascotPose; size?: number; className?: string }) {
  return (
    <img
      src={SOURCES[pose]}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      decoding="async"
      draggable={false}
      className={cn("mascot-bob shrink-0 select-none", className)}
    />
  );
}
