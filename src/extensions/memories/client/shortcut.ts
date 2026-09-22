import { Camera } from "lucide-react";
import type { ExtensionShortcut } from "@extensions/client/types";
import { useKomaNow } from "./koma-api";

/**
 * 近道の帯に出すひとコマ。今日を始めていて、いまの枠にまだ残していないときだけ返す。F-126
 * 画像は、今日の自分の最後のひとコマ。
 * @param enabled 思い出の拡張が使えるときだけ true。false なら読み込まない
 */
export function useKomaShortcut(enabled: boolean): ExtensionShortcut | null {
  const now = useKomaNow(enabled);
  const data = now.data;
  if (!enabled || !data?.started || !data.slot || data.taken) return null;
  return {
    label: `${data.slot.hour} 時のひとコマ`,
    sub: `${data.memory?.title ?? "ひとコマ"}・${data.slot.hour + 1}:00 まで`,
    image: data.last?.thumbUrl,
    path: "/memories/koma/now",
    action: "撮る",
    icon: Camera,
  };
}
