/**
 * 夜空のテーマの星を、端末の傾きでゆっくりずらす視差。0095、#279
 *
 * 傾きは今日の行と同じ useDeviceTilt から取る(最大 6px)。許可も同じ 1 回の問いを使い、新しい窓は出さない。
 * 値は html の CSS 変数 `--star-x`・`--star-y`(px)に置き、星の層ごとの倍率は tokens.css が掛ける。
 * 動かすのは、夜空のテーマで、動きを減らしておらず、指で持つ端末(pointer: coarse)のときだけ。
 */
import { useEffect, useState } from "react";
import { type TiltOffset, useDeviceTilt } from "./use-device-tilt";
import { useMediaQuery } from "./use-media-query";

export type StarParallaxInput = { look: string | undefined; reduced: boolean; touch: boolean };

/** 星を動かしてよいか。夜空で、動きを減らしておらず、タッチ端末のとき */
export function starParallaxEnabled({ look, reduced, touch }: StarParallaxInput): boolean {
  return look === "night" && !reduced && touch;
}

/** 傾きのずらしを CSS 変数の値にする。動かさないときは 0 */
export function starVars(enabled: boolean, offset: TiltOffset): { x: string; y: string } {
  if (!enabled) return { x: "0px", y: "0px" };
  return { x: `${offset.x}px`, y: `${offset.y}px` };
}

function useLook(): string | undefined {
  const [look, setLook] = useState(() => document.documentElement.dataset.look);
  useEffect(() => {
    const el = document.documentElement;
    const read = () => setLook(el.dataset.look);
    read();
    const observer = new MutationObserver(read);
    observer.observe(el, { attributes: true, attributeFilter: ["data-look"] });
    return () => observer.disconnect();
  }, []);
  return look;
}

/** ログイン後の枠に 1 つだけ置く。星の視差の CSS 変数を html に出す */
export function useStarParallax(): void {
  const look = useLook();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");
  const touch = useMediaQuery("(pointer: coarse)");
  const enabled = starParallaxEnabled({ look, reduced, touch });
  const { offset, requestOnce } = useDeviceTilt(enabled);

  useEffect(() => {
    if (!enabled) return;
    // iOS は操作の中でしか許可の窓を出せない。最初に触った 1 回だけ尋ねる(今日の行と同じ仕組み)
    window.addEventListener("pointerdown", requestOnce, { once: true });
    return () => window.removeEventListener("pointerdown", requestOnce);
  });

  useEffect(() => {
    const { x, y } = starVars(enabled, offset);
    const style = document.documentElement.style;
    style.setProperty("--star-x", x);
    style.setProperty("--star-y", y);
    return () => {
      style.removeProperty("--star-x");
      style.removeProperty("--star-y");
    };
  }, [enabled, offset]);
}
