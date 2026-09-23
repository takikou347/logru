/** 画面と API がやり取りする形。API の応答はここの型に合わせる */
import type { LegalDocument } from "@shared/legal";

/** 明るさの設定。system は端末に合わせる */
export type ThemeMode = "system" | "light" | "dark";

/** アバターの出し方。既定は頭文字。#40 */
export type AvatarKind = "initial" | "photo";

/** 背景のテーマ。glass は奥を透かすガラス、flat は透かさず塗る。#50 */
export type BgTheme = "glass" | "flat";

/** `GET /api/me` の応答 */
export type Me = {
  user: { id: string; name: string; email: string; image: string | null; avatarUrl: string | null };
  settings: {
    themeMode: ThemeMode;
    bgTheme: BgTheme;
    accentColor: string;
    userColor: string;
    avatarKind: AvatarKind;
    /** 案内を見た画面の ID。F-33 */
    toursSeen: string[];
    /** 足した機能のタイルの並び。key の配列。0058 */
    extensionOrder: string[];
  };
  /** 同意を取り直す文書。空なら同意済み */
  needsAgreement: LegalDocument[];
  /** ログインに使った手段。`google.com` か `password` */
  provider: string;
  /** 自分の画面だけの色 */
  colorPrefs: { targetType: "group" | "user"; targetId: string; color: string }[];
  /** カレンダーに出さない人の ID。自分の画面だけの設定。F-20 */
  hiddenMembers: string[];
  /** はじめての案内を見終えたか飛ばした日時。null ならカレンダーで案内を出す。F-32 */
  onboardedAt: number | null;
  /** 設定に「ラボ」の欄を出すか。本番はいつも false。0038、0039、F-35 */
  showLab: boolean;
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

/** 繰り返しの規則。無ければ繰り返さない。予定の拡張で使う。0043 */
export type RepeatRule = {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  /** weekly だけで使う。月を 1、日を 7 とした数 */
  daysOfWeek?: number[];
  /** 終わりの日。ミリ秒の UTC */
  until?: number | null;
  /** 終わりの回数 */
  count?: number | null;
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
  /** 予定ではないことを見分ける種類の名前。読み上げで題名の前に添える。カレンダーは表示に文字を使わない。例は「思い出」。0056 */
  tag?: string;
  /** 月の表には出すが、予定の一覧には出さない項目。一覧の下に小さく出す。例は記録の数 */
  secondary?: boolean;
  /**
   * 何の記録かを見分ける種類。無ければ予定として扱い、色の点のまま出す。
   * record は拡張のアイコンを頭に付けた札、expense は塗らない札に金額を右寄せする。絞り込みの帯の「種類」にも使う。0056
   */
  kind?: "record" | "expense";
  /**
   * 種類の中でさらに見分ける形。決まった名前の中から選ぶ(例は "camera")。
   * 無ければ項目を出した拡張の登録したアイコンを使う。1 つの拡張で複数の種類を出し分けたいときに指定する。0056
   */
  icon?: string;
  /** kind が expense の項目の生の金額。選んだ日の一覧で、その日の合計を出すのに使う。0056 */
  amount?: number;
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
  /** 繰り返しの規則。無ければ繰り返さない。予定の拡張で使う。0043 */
  repeat?: RepeatRule | null;
  /**
   * 繰り返す項目の、この回の規則どおりの始まりの時刻。同じ予定の別の回を見分けるのに使う。
   * 繰り返さない項目には付かない。0043
   */
  occurrenceAt?: number;
  /**
   * その日の小さな写真。32 px の JPEG を data URL にしたもの。1 年をらせんで見る画面で使う。0051
   * 思い出の拡張が、日ごとにまとめる「記録」の項目に乗せる。無ければ写真を置かない
   */
  thumb?: string;
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

/** ホームの並びを持つ形。PC とスマホで別に持つ。0029 */
export type HomeForm = "desktop" | "mobile";

/** 並びの 1 件。ウィジェットの中身は持たず、key だけ。大きさは持たない。0037 */
export type HomeWidgetEntry = { key: string };

/** `GET`、`PUT /api/me/home-layout` の応答。保存がまだ無ければ widgets は null。0029 */
export type HomeLayout = { widgets: HomeWidgetEntry[] | null };

/** お知らせの一覧の 1 件。文言と行き先は、積んだ拡張の describeNotification が決める。#32 */
export type NotificationItem = {
  id: string;
  /** `<拡張の key>.<拡張が決めた名前>` の形。例は `events.invite_accepted` */
  kind: string;
  payload: Record<string, unknown>;
  /** 既読にした時刻。まだなら null */
  readAt: number | null;
  createdAt: number;
};

/** `GET /api/notifications` の応答。25 件ずつのページ */
export type NotificationPage = { items: NotificationItem[]; nextCursor: string | null };
