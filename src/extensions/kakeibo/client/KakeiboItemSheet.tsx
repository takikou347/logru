import type { ItemEditorProps } from "@extensions/client/types";
import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * カレンダーの家計簿の項目を押したときのシート。0008、0047
 * 項目は日ごとの合計で、1 件の記録ではないので、シートは出さずにその月の家計簿の画面へ移る。
 */
export function KakeiboItemSheet({ target, onClose }: ItemEditorProps) {
  const navigate = useNavigate();
  const item = target.mode === "edit" ? target.item : null;
  // ID は `<グループ ID>:<日付>`。日付の頭 7 文字が月になる
  const date = item?.id.slice(item.id.indexOf(":") + 1) ?? null;

  useEffect(() => {
    if (!item || !date) return;
    onClose();
    navigate(`/kakeibo?month=${date.slice(0, 7)}&group=${item.groupId}`);
  }, [item, date, navigate, onClose]);

  return null;
}
