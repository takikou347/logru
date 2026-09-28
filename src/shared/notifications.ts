/**
 * お知らせの種類の共通の形。拡張の manifest と、土台(グループの増減など特定の拡張に属さないもの)の
 * 両方がこの形で種類を並べる。設定の「お知らせ」は、これを読んで行を出す。0096
 */

/** お知らせの種類 1 つ。kind は `<拡張の key>.<名前>` の形 */
export type NotificationKindDef = {
  kind: string;
  /** 設定の「お知らせ」に出す行の名前 */
  label: string;
  /** 一覧に出すかの既定 */
  defaultList: boolean;
  /** 端末にも知らせるかの既定 */
  defaultPush: boolean;
};

/** 種類ごとの、一覧に出すか・端末にも知らせるかの組。無ければ既定を使う。0096 */
export type NotificationPref = { list: boolean; push: boolean };

/** `Me.settings.notificationPrefs` の形。既定から変えた種類だけを持つ */
export type NotificationPrefs = Record<string, NotificationPref>;

/**
 * グループの増減や、拡張が足されたときの知らせ。特定の拡張のものではないので、土台がここに持つ。
 * kind の頭は `groups.`。0096、issue #245
 */
export const CORE_NOTIFICATION_KINDS = [
  { kind: "groups.member_joined", label: "グループに入った", defaultList: true, defaultPush: false },
  { kind: "groups.member_left", label: "グループを抜けた", defaultList: true, defaultPush: false },
  { kind: "groups.extension_added", label: "グループに機能が足された", defaultList: true, defaultPush: false },
] as const satisfies readonly NotificationKindDef[];

/** 土台が積む kind の型 */
export type CoreNotificationKind = (typeof CORE_NOTIFICATION_KINDS)[number]["kind"];
