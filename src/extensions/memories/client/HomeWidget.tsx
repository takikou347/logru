/**
 * ホームから 1 回押すだけで移る、思い出のウィジェット。0029、0037
 * いつも同じ中身を出す。「いま」だけの近道は、カレンダーの上の帯(F-26)が受け持つ。
 * 見た目は共通の `HomeWidgetCard`。0081
 */
import { Camera, Timer } from "lucide-react";
import { HomeWidgetCard } from "@/components/parts/HomeWidgetCard";

/** 「ひとコマ」。押すとひとコマの画面へ移る。F-128 */
export function KomaHomeWidget() {
  return <HomeWidgetCard to="/memories/koma" testId="widget-koma" icon={Timer} label="ひとコマ" hint="1 時間に 1 枚" />;
}

/** 「写真を記録する」。押すと記録のシートが開く。F-112 */
export function RecordHomeWidget() {
  return (
    <HomeWidgetCard
      to="/memories?record=1"
      testId="widget-record"
      icon={Camera}
      label="写真を記録する"
      hint="写真と一言"
    />
  );
}
