/**
 * 端末の傾きで、中身をわずかにずらす奥行き。0044、0048、#112
 *
 * 動かすのは transform だけ。ガラスの面自体は動かさない。呼ぶ側が、包む要素の transform に足す。
 * iOS は許可が要る。requestOnce を、触った最初の 1 回だけ呼ぶ。ユーザーの操作の中で呼ばないと、iOS が窓を出さない。
 * 一度尋ねたら、許しても断っても、二度と尋ねない。Android などはもともと許可が要らないので、何もしない。
 */
import { useEffect, useState } from "react";

/** 中身をずらす最大の大きさ(px) */
const MAX_OFFSET_PX = 6;
/** 傾きをこの角度(度)でずらしが最大になる。指で持つ程度の傾きで奥行きが出る大きさ */
const FULL_TILT_DEG = 30;
/** 一度でも許可を求めたか覚える、端末の localStorage の鍵 */
const ASKED_KEY = "logru:tilt-asked";

export type TiltOffset = { x: number; y: number };

function clamp(v: number, max: number): number {
  return Math.max(-max, Math.min(max, v));
}

/**
 * DeviceOrientationEvent の角度から、ずらす px を計算する。最大 6px。#112
 * @param beta 前後の傾き(-180〜180)
 * @param gamma 左右の傾き(-90〜90)
 */
export function tiltOffset(beta: number | null, gamma: number | null): TiltOffset {
  return {
    x: clamp(((gamma ?? 0) / FULL_TILT_DEG) * MAX_OFFSET_PX, MAX_OFFSET_PX),
    y: clamp(((beta ?? 0) / FULL_TILT_DEG) * MAX_OFFSET_PX, MAX_OFFSET_PX),
  };
}

/** iOS 13 以降だけが持つ、許可を求める窓口。無ければ許可が要らない端末 */
function requestPermissionFn(): (() => Promise<"granted" | "denied">) | null {
  if (typeof window === "undefined" || !window.DeviceOrientationEvent) return null;
  const DOE = window.DeviceOrientationEvent as unknown as {
    requestPermission?: () => Promise<"granted" | "denied">;
  };
  return typeof DOE.requestPermission === "function" ? DOE.requestPermission.bind(DOE) : null;
}

function wasAsked(): boolean {
  try {
    return localStorage.getItem(ASKED_KEY) === "1";
  } catch {
    return false;
  }
}

function markAsked(): void {
  try {
    localStorage.setItem(ASKED_KEY, "1");
  } catch {
    // 保存できない環境では、開くたびに許可を求め直すだけで、動きそのものは動く
  }
}

export function useDeviceTilt(enabled: boolean): { offset: TiltOffset; requestOnce: () => void } {
  const [offset, setOffset] = useState<TiltOffset>({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      setOffset({ x: 0, y: 0 });
      return;
    }
    function onOrientation(e: DeviceOrientationEvent) {
      setOffset(tiltOffset(e.beta, e.gamma));
    }
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, [enabled]);

  function requestOnce() {
    if (!enabled || wasAsked()) return;
    const request = requestPermissionFn();
    if (!request) return; // 許可が要らない端末。addEventListener だけで動く
    markAsked();
    void request().catch(() => undefined);
  }

  return { offset, requestOnce };
}
