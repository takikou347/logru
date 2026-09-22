/** 画面と API がやり取りする形。API の応答はここの型に合わせる */
import type { LegalDocument } from "@shared/legal";

/** 明るさの設定。system は端末に合わせる */
export type ThemeMode = "system" | "light" | "dark";

/** アバターの出し方。既定は頭文字。#40 */
export type AvatarKind = "initial" | "photo";

/** `GET /api/me` の応答 */
export type Me = {
  user: { id: string; name: string; email: string; image: string | null; avatarUrl: string | null };
  settings: { themeMode: ThemeMode; accentColor: string; userColor: string; avatarKind: AvatarKind };
  /** 同意を取り直す文書。空なら同意済み */
  needsAgreement: LegalDocument[];
  /** ログインに使った手段。`google.com` か `password` */
  provider: string;
  /** 自分の画面だけの色 */
  colorPrefs: { targetType: "group" | "user"; targetId: string; color: string }[];
  /** カレンダーに出さない人の ID。自分の画面だけの設定。F-20 */
  hiddenMembers: string[];
};

/** グループのメンバー */
export type GroupMember = {
  id: string;
  name: string;
  userColor: string;
  role: "admin" | "member";
  /** 置いた写真の URL。頭文字を選んでいるか、写真が無ければ null。#40 */
  avatarUrl: string | null;
};

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
  /** このグループで有効にした、切り替えられる拡張の key。いつも有効な拡張は含めない。0019 */
  extensions: string[];
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
  /** 項目の色の名前。あればグループの色より先に使う。外部のカレンダーで使う */
  color?: string;
  /** グループの名前の代わりに出す名前。外部のカレンダーの名前など */
  sourceName?: string;
  /** 予定ではないことを見分ける印。一覧と月の表で、題名の前に出す。例は「思い出」 */
  tag?: string;
  /** 月の表には出すが、予定の一覧には出さない項目。一覧の下に小さく出す。例は記録の数 */
  secondary?: boolean;
  /**
   * 参加者と、それぞれの返事。人を招待できる拡張だけが入れる。予定の拡張では、作った人もいつも入る。#28
   * 無ければ、参加者の考えが無い項目として扱う
   */
  attendees?: Attendee[];
  /**
   * 項目を読んだ人の返事。カレンダーはこれで見た目を変える。
   * 返事待ちは枠線だけ、参加しないは薄くして取り消し線。招待されていなければ省く。作った人は accepted
   */
  myResponse?: AttendeeResponse;
};

/** 招待への返事。pending は返事待ち、accepted は参加する、declined は参加しない */
export type AttendeeResponse = "pending" | "accepted" | "declined";

/** 項目の参加者の 1 人 */
export type Attendee = { userId: string; response: AttendeeResponse };

/** グループの設定に出す、切り替えられる拡張 */
export type ExtensionInfo = { key: string; label: string; description: string; enabled: boolean };

/** `GET /api/extensions` の 1 件。機能の一覧に出す。F-24 */
export type ExtensionOverview = {
  key: string;
  label: string;
  description: string;
  /** 自分だけのグループで有効か */
  personal: boolean;
  /** この拡張を有効にしている、入っている共有のグループ */
  groups: { id: string; name: string }[];
};

/** `GET /api/invites/:token` の応答 */
export type InviteInfo = { groupName: string; expiresAt: number; valid: boolean; reason?: "expired" | "revoked" };

/** `GET /api/me/push` の応答。F-23 */
export type PushInfo = {
  /** VAPID の公開鍵。無ければ、この環境では知らせを送れない */
  publicKey: string | null;
  devices: { id: string; endpoint: string; userAgent: string | null; createdAt: number }[];
};
