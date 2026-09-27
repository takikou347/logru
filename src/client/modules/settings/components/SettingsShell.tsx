import type { ReactNode } from "react";
import { Page, PageBar, SideHeading } from "@/components/layout/AppLayout";
import { useAppFrame } from "@/components/layout/AppShell";
import { SettingsToc } from "./SettingsToc";

/**
 * 設定の各節の枠。PC は AppShell の左の列に設定の目次を足し、右に節の中身を出す 2 列になる。issue #102
 * スマホは目次を出さず、上の帯の戻るボタンで `/settings` の目次へ戻る。
 *
 * 左の列の上には、アプリの行き先(カレンダー、機能を足す、外すなど)が並ぶ。そこと目次を分けて
 * 見せるため、目次の上に「設定」の見出しと区切りを 1 つ入れる。選ばれた色は、目次の中の 1 か所だけになる。issue #13
 */
export function SettingsShell({
  title,
  poolColors,
  poolFocus,
  back = "/settings",
  backMobileOnly = true,
  children,
}: {
  title: string;
  poolColors: string[];
  poolFocus?: number | null;
  /** 戻る先。既定は設定の目次。拡張の詳細は一覧の `/settings/extensions` を渡す */
  back?: string;
  /** 既定は PC で隠す。目次の節では PC に別の道順(目次そのもの)があるため。拡張の詳細では false にする */
  backMobileOnly?: boolean;
  children: ReactNode;
}) {
  useAppFrame({
    poolColors,
    poolFocus,
    side: (
      <div className="flex flex-col gap-2 border-t border-line pt-3">
        <SideHeading>設定</SideHeading>
        <SettingsToc variant="side" />
      </div>
    ),
  });

  return (
    <Page>
      <PageBar title={title} back={back} backMobileOnly={backMobileOnly} />
      {children}
    </Page>
  );
}
