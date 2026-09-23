import { useEffect } from "react";
import { useNavigate } from "react-router";
import { Loading } from "@/app/guards";
import { useLists } from "./api";

/**
 * いちばん新しいリストへの近道。F-209
 * 機能のシートの「リストに足す」と、ホームのウィジェットの入口はここを通る。
 * リストがあれば、入力欄にカーソルが入った状態でその画面を開く。無ければ、作るシートを出す一覧へ移る。
 */
export function ListsLatestPage() {
  const navigate = useNavigate();
  const lists = useLists(null);

  useEffect(() => {
    if (!lists.data) return;
    const latest = lists.data[0];
    navigate(latest ? `/lists/${latest.id}?add=1` : "/lists?create=1", { replace: true });
  }, [lists.data, navigate]);

  return <Loading />;
}
