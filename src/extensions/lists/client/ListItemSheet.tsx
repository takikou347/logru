import type { ItemEditorProps } from "@extensions/client/types";
import { useEffect } from "react";
import { useNavigate } from "react-router";

/**
 * カレンダーのリストの項目を押したときのシート。0054
 * リストの画面自身で足す・チェックする・消すを行うので、シートは出さずにその画面へ移る。
 */
export function ListItemSheet({ target, onClose }: ItemEditorProps) {
  const navigate = useNavigate();
  const item = target.mode === "edit" ? target.item : null;

  useEffect(() => {
    if (!item) return;
    onClose();
    navigate(`/lists/${item.id}`);
  }, [item, navigate, onClose]);

  return null;
}
