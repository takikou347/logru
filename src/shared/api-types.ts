import type { LegalDocument } from "./legal";

export type ThemeMode = "system" | "light" | "dark";

export type Me = {
  user: { id: string; name: string; email: string; image: string | null };
  settings: { themeMode: ThemeMode; accentColor: string; userColor: string };
  /** 同意を取り直す文書。空なら同意済み */
  needsAgreement: LegalDocument[];
  loginMethods: ("credential" | "google")[];
  colorPrefs: { targetType: "group" | "user"; targetId: string; color: string }[];
  googleEnabled: boolean;
};

export type GroupMember = { id: string; name: string; userColor: string; role: "admin" | "member" };

export type GroupSummary = {
  id: string;
  name: string;
  color: string;
  isPersonal: boolean;
  role: "admin" | "member";
  members: GroupMember[];
};

/** 0008 の約束に沿う。カレンダーに並べる 1 件 */
export type CalendarItem = {
  extension: string;
  id: string;
  groupId: string;
  createdBy: string | null;
  startsAt: number;
  endsAt: number | null;
  allDay: boolean;
  title: string;
  memo?: string | null;
  place?: string;
  companionIds?: string[];
};

export type ExtensionInfo = { key: string; label: string; description: string; enabled: boolean };

export type InviteInfo = { groupName: string; expiresAt: number; valid: boolean; reason?: "expired" | "revoked" };
