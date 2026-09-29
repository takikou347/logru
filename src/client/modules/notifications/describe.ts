/**
 * グループの増減や、拡張が足されたときのお知らせの、文言と行き先。特定の拡張のものではなく土台の kind
 * (`groups.*`)なので、拡張の describeNotification とは別にここへ置く。0096、issue #245
 */
import { clientExtension } from "@extensions/client/registry";
import type { NotificationDescriptor } from "@extensions/client/types";

/** グループの画面。グループに入った・抜けたの行き先 */
const GROUPS_PATH = "/groups";

/**
 * `groups.*` の kind から、一覧の文言と押したときの行き先を作る。自分の kind でなければ null
 */
export function describeCoreNotification(
  kind: string,
  payload: Record<string, unknown>,
): NotificationDescriptor | null {
  const groupName = typeof payload.groupName === "string" && payload.groupName ? payload.groupName : "グループ";
  const byUserName = typeof payload.byUserName === "string" ? payload.byUserName : "";
  if (kind === "groups.member_joined") {
    return { text: `${byUserName ? `${byUserName}が` : ""}「${groupName}」に入りました。`, path: GROUPS_PATH };
  }
  if (kind === "groups.member_left") {
    return { text: `${byUserName ? `${byUserName}が` : ""}「${groupName}」を抜けました。`, path: GROUPS_PATH };
  }
  if (kind === "groups.extension_added") {
    const extKey = typeof payload.extensionKey === "string" ? payload.extensionKey : "";
    const ext = clientExtension(extKey);
    const label = ext?.manifest.label ?? "機能";
    return {
      text: `「${groupName}」に${label}が足されました。`,
      path: ext?.nav?.path ?? GROUPS_PATH,
    };
  }
  return null;
}
