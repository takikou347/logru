import type { ReactNode } from "react";
import { AppLayout, Page, PageBar } from "@/components/layout/AppLayout";
import { SettingsToc } from "./SettingsToc";

/**
 * 設定の各節の枠。PC は AppLayout の左の列に設定の目次を足し、右に節の中身を出す 2 列になる。issue #102
 * スマホは目次を出さず、上の帯の戻るボタンで `/settings` の目次へ戻る。
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
  return (
    <AppLayout poolColors={poolColors} poolFocus={poolFocus} side={<SettingsToc variant="side" />}>
      <Page>
        <PageBar title={title} back={back} backMobileOnly={backMobileOnly} />
        {children}
      </Page>
    </AppLayout>
  );
}
