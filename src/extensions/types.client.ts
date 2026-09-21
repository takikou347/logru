/**
 * 画面の側の拡張が守る約束。サーバーの側は types.ts にある。
 *
 * カレンダーは拡張の中身を知らない。項目を押したら、項目の extension に合う拡張の Editor を開き、
 * 消すときは同じ拡張の deleteItem を呼ぶ。
 */
import type { ComponentType } from "react";
import type { CalendarItem, GroupSummary, Me } from "../shared/api-types";
import type { ExtensionManifest } from "./types";

/** 編集のシートを開くときの対象。新しく作るか、既にある項目を直すか */
export type EditorTarget = { mode: "new"; date: Date; groupId?: string } | { mode: "edit"; item: CalendarItem };

/** 編集のシートが受け取るもの */
export type ItemEditorProps = {
  target: EditorTarget;
  /** 入っているグループ。項目をどのグループに置くかを選ばせる */
  groups: GroupSummary[];
  me: Me;
  onClose: () => void;
  /** 消すとき。消す処理はカレンダーが持ち、5 秒のあいだ元に戻せるようにする */
  onDelete: (item: CalendarItem) => void;
};

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
};
