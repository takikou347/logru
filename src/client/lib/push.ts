/**
 * この端末で、知らせを受けるかを切り替える。F-23、0023
 * 許可は、押したときにだけ求める。iPhone は、ホーム画面に足したときだけ届く。
 */

import type { PushInfo } from "@shared/api-types";
import { api } from "../api/client";

/** この端末で知らせを受けられるか。受けられない理由も返す */
export function pushSupport(): { ok: true } | { ok: false; reason: string } {
  if (
    typeof window === "undefined" ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window) ||
    !("Notification" in window)
  ) {
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    return {
      ok: false,
      reason: ios
        ? "iPhone では、共有のボタンから「ホーム画面に追加」してから開くと、通知を受け取れます。"
        : "このブラウザーでは通知を受け取れません。",
    };
  }
  return { ok: true };
}

function toBytes(b64url: string): Uint8Array {
  const s = atob(b64url.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat((4 - (b64url.length % 4)) % 4));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** この端末の、いまの送り先。無ければ null */
export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupport().ok) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

/**
 * この端末で知らせを受ける。許可を求め、送り先をサーバーに置く。
 * @throws 許可されなかったとき、この環境で送れないとき
 */
export async function enablePush(info: PushInfo): Promise<void> {
  if (!info.publicKey) throw new Error("この環境では通知を送れません。");
  const permission = await Notification.requestPermission();
  if (permission !== "granted")
    throw new Error("通知が許可されませんでした。端末の設定で、このサイトの通知を許可してください。");
  const reg = await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(info.publicKey) as BufferSource,
    }));
  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  await api("/me/push", {
    method: "POST",
    body: { endpoint: json.endpoint, keys: json.keys, userAgent: navigator.userAgent.slice(0, 200) },
  });
}

/** この端末で知らせを受けないようにする。サーバーの送り先も消す */
export async function disablePush(info: PushInfo): Promise<void> {
  const sub = await currentSubscription();
  const device = info.devices.find((d) => d.endpoint === sub?.endpoint);
  if (device) await api(`/me/push/${device.id}`, { method: "DELETE" });
  await sub?.unsubscribe();
}
