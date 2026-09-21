/** 画面と API がやり取りする形。API の応答はここの型に合わせる */
import type { LegalDocument } from "./legal";

/** 明るさの設定。system は端末に合わせる */
export type ThemeMode = "system" | "light" | "dark";

/** `GET /api/me` の応答 */
export type Me = {
  user: { id: string; name: string; email: string; image: string | null };
  settings: { themeMode: ThemeMode; accentColor: string; userColor: string };
  /** 同意を取り直す文書。空なら同意済み */
  needsAgreement: LegalDocument[];
  /** ログインに使った手段。`google.com` か `password` */
  provider: string;
  /** 自分の画面だけの色 */
  colorPrefs: { targetType: "group" | "user"; targetId: string; color: string }[];
};

/** グループのメンバー */
export type GroupMember = { id: string; name: string; userColor: string; role: "admin" | "member" };

/** `GET /api/groups` の 1 件 */
export type GroupSummary = {
  id: string;
  name: string;
  /** グループの色の名前。自分だけのグループは自分の色 */
  color: string;
  isPersonal: boolean;
  /** 自分の役割 */
  role: "admin" | "member";
  members: GroupMember[];
};

/** カレンダーに並べる 1 件。拡張はこの形で項目を渡す。0002、0008 */
export type CalendarItem = {
  /** 項目を出した拡張の key */
  extension: string;
  /** 拡張の中での ID */
  id: string;
  groupId: string;
  createdBy: string | null;
  /** 始まり。ミリ秒の UTC */
  startsAt: number;
  /** 終わり。含まない。無ければ始まりの日だけ */
  endsAt: number | null;
  allDay: boolean;
  title: string;
  memo?: string | null;
  place?: string;
  companionIds?: string[];
};

/** グループの設定に出す、切り替えられる拡張 */
export type ExtensionInfo = { key: string; label: string; description: string; enabled: boolean };

/** `GET /api/invites/:token` の応答 */
export type InviteInfo = { groupName: string; expiresAt: number; valid: boolean; reason?: "expired" | "revoked" };
