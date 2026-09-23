/**
 * 画面ごとの案内(コーチマーク)。画面と API の両方が使う。F-33
 *
 * 見た画面の ID を user_settings.tours_seen に持つ。別の端末でも同じになる。
 */

/** 案内の 1 枚 */
export type TourStep = {
  /**
   * 指す場所の CSS セレクター。例は `[data-tour="edit-home"]`。見えているものの最初を指す。
   * 省くと、どこも指さず下から出るシートで読ませる。画面に無ければ、その 1 枚を飛ばす
   */
  target?: string;
  /** 文言。1 文か 2 文 */
  text: string;
};

/** 案内の ID の形。英小文字、数字、ハイフン。拡張の案内は `ext.<拡張の key>` */
export const TOUR_ID_PATTERN = /^[a-z0-9-]+(\.[a-z0-9-]+)?$/;

/** 持っておく ID の上限。超えたら古いものから落とす */
export const MAX_TOURS_SEEN = 100;

/** 拡張の画面の案内の ID */
export function extensionTourId(extensionKey: string): string {
  return `ext.${extensionKey}`;
}

/**
 * 見た画面の一覧に ID を足す。同じ ID は 2 つ持たない。上限を超えたら古いものから落とす。
 * @param seen いまの一覧
 * @param id 見た画面の ID
 */
export function addTourSeen(seen: readonly string[], id: string): string[] {
  const next = [...seen.filter((s) => s !== id), id];
  return next.slice(Math.max(0, next.length - MAX_TOURS_SEEN));
}
