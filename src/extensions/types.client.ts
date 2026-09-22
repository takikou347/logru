/**
 * 画面の側の拡張が守る約束。サーバーの側は types.ts にある。
 *
 * カレンダーは拡張の中身を知らない。項目を押したら、項目の extension に合う拡張の Editor を開き、
 * 消すときは同じ拡張の deleteItem を呼ぶ。
 */
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { CalendarItem, GroupSummary, Me } from "../shared/api-types";
import type { ExtensionManifest } from "./types";

/** 編集のシートを開くときの対象。新しく作るか、既にある項目を直すか */
export type EditorTarget = { mode: "new"; date: Date; groupId?: string } | { mode: "edit"; item: CalendarItem };

/**
 * 新しく作るシートに並べる、その日に既にある項目。ほかの拡張の項目も入る。
 * 色とグループ名はカレンダーが付ける。拡張はグループの色の決まりを知らなくてよい
 */
export type DayItem = CalendarItem & {
  /** グループの色の名前。`c-<color>` のクラスや Dot に渡す */
  color: string;
  /** グループの名前。自分だけのグループは「自分」 */
  groupName: string;
};

/** 編集のシートが受け取るもの */
export type ItemEditorProps = {
  target: EditorTarget;
  /**
   * target が new のとき、その日に既にある項目。時刻の順。
   * シートはフォームの上に一覧で出し、押されたら onOpenItem を呼ぶ。空なら何も出さない
   */
  dayItems?: DayItem[];
  /** dayItems の項目が押されたとき。カレンダーが、その項目の拡張の直すシートに切り替える */
  onOpenItem?: (item: CalendarItem) => void;
  /** 入っているグループ。項目をどのグループに置くかを選ばせる */
  groups: GroupSummary[];
  me: Me;
  onClose: () => void;
  /** 消すとき。消す処理はカレンダーが持ち、5 秒のあいだ元に戻せるようにする */
  onDelete: (item: CalendarItem) => void;
};

/** 拡張の画面。0019 */
export type ExtensionPage = {
  /** 道順。拡張の名前で始める。例は `/memories/:id` */
  path: string;
  /** 開いたときに読む画面 */
  load: () => Promise<{ Component: ComponentType }>;
};

/** 入口に出す画面。PC は左の列、スマホは機能のシートに並ぶ */
export type ExtensionNav = { label: string; icon: LucideIcon; path: string; description?: string };

/** 機能のシートに出す、すぐする操作。押すと path へ移る。例は「記録する」 */
export type ExtensionAction = { label: string; icon: LucideIcon; path: string; hint?: string };

/**
 * いま押してほしい近道。カレンダーの上の帯に出す。F-26
 * 返すものが無ければ帯は出ない。
 */
export type ExtensionShortcut = { label: string; sub: string; image?: string; path: string; action: string; icon: LucideIcon };

/** 画面の側の拡張 */
export type ClientExtension = {
  manifest: ExtensionManifest;
  /** 項目を作ったり直したりするシート */
  Editor: ComponentType<ItemEditorProps>;
  /**
   * 項目を消す。読むだけの拡張は省く。省くと、カレンダーは消す操作を出さない
   * @param keepalive 画面を閉じるときに送り切る
   */
  deleteItem?: (id: string, opts: { keepalive: boolean }) => Promise<void>;
  /** 設定の画面に出す欄。利用者ごとの拡張が、登録の画面を置くのに使う。無ければ省く */
  SettingsSection?: ComponentType;
  /**
   * カレンダーの「読み直す」を押したときに、拡張が先にしておく仕事。外から予定を読み直すなど。無ければ省く。
   * 全部の拡張の分を並べて待ってから、カレンダーは項目を読み直す。
   * @returns 読めなかったものの名前。画面の知らせに出す
   */
  refresh?: () => Promise<{ failed: string[] }>;
  /** 拡張の画面。どれかのグループで有効なときだけ開ける。0019 */
  pages?: ExtensionPage[];
  /** 入口に出す画面 */
  nav?: ExtensionNav;
  /** 機能のシートに出す、すぐする操作 */
  actions?: ExtensionAction[];
  /**
   * 近道を返す hook。F-26
   * hook なので、呼ぶ順を変えないよう、拡張の一覧の順にいつも呼ぶ。使えないときは enabled が false で、読み込みを止める
   */
  useShortcut?: (enabled: boolean) => ExtensionShortcut | null;
};
