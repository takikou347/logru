import type { ReactNode } from "react";
import { Link } from "react-router";
import { Panel } from "@/components/parts/Panel";
import { REOPEN_PARAM } from "../../onboarding/model";

/** 欄の中の 1 行の見た目。children に渡す RowButton と同じ形にそろえる */
const helpRowClass =
  "flex min-h-12 w-full items-center gap-3 border-b border-line text-left text-[15px] text-ink no-underline last:border-b-0";

/** 押すと別の画面へ移る行。右に「›」を出す */
function HelpLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className={helpRowClass}>
      <span className="flex-1">{children}</span>
      <span className="text-lg text-ink-3" aria-hidden="true">
        ›
      </span>
    </Link>
  );
}

/**
 * 設定の「使い方」。案内を見返す場所。F-32
 *
 * 行は上から、はじめての案内、children、よくある質問の順に並ぶ。
 * 画面の案内を出し直す行や、ホーム画面に追加する行は、children に渡して足す。
 */
export function HelpSection({ children }: { children?: ReactNode }) {
  return (
    <Panel title="使い方">
      <div>
        <HelpLink to={`/?${REOPEN_PARAM}=1`}>はじめての案内をもう一度見る</HelpLink>
        {children}
        <HelpLink to="/help">よくある質問</HelpLink>
      </div>
    </Panel>
  );
}
