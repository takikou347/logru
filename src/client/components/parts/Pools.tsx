import { cn } from "@/lib/utils";

/**
 * グループの色のインクだまり。ガラスの裏に置く。0010
 *
 * 画面の一番奥に固定し、ぼかした 3 色の丸を置く。focus を渡すと、その色だけが膨らみ、ほかは引く。
 * 丸は漂わせない。動かし続けると、ぼかしとガラスを毎フレーム描き直し、画面がちらつく。#3
 * 動きを減らす設定では、膨らむ動きも止める。
 *
 * @param colors 3 つの色の名前。足りなければ既定の色で埋める
 * @param focus 膨らませる色の番号。0 から 2。null なら 3 色とも同じ大きさ
 */
export function Pools({ colors, focus }: { colors: string[]; focus?: number | null }) {
  const [a = "wakatake", b = "yamabuki", c = "asagi"] = colors;
  const dim = (i: number) => focus != null && focus !== i;
  const grow = (i: number) => focus === i;
  const pool =
    "absolute aspect-square rounded-full bg-(--c) opacity-(--pool-opacity) blur-[46px] transition-[transform,opacity] duration-900 ease-out";
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true" data-pools>
      <i
        className={cn(
          pool,
          `c-${a}`,
          "top-[10vh] -left-[18vw] w-[min(70vw,520px)]",
          grow(0) && "scale-155",
          dim(0) && "scale-60 opacity-25",
        )}
      />
      <i
        className={cn(
          pool,
          `c-${b}`,
          "top-[40vh] -right-[22vw] w-[min(78vw,620px)] [animation-delay:-12s]",
          grow(1) && "scale-155",
          dim(1) && "scale-60 opacity-25",
        )}
      />
      <i
        className={cn(
          pool,
          `c-${c}`,
          "-bottom-[18vh] left-[12vw] w-[min(62vw,480px)] [animation-delay:-24s]",
          grow(2) && "scale-155",
          dim(2) && "scale-60 opacity-25",
        )}
      />
    </div>
  );
}
