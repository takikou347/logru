import { useState } from "react";
import { InstallGuideSheet } from "@/components/parts/InstallGuideSheet";
import { RowButton } from "@/components/parts/Panel";
import { currentPlatform, currentStandalone } from "@/lib/pwa";

/**
 * 「ホーム画面に追加する」。手順のシートを開く。F-34
 * PC と、ホーム画面から開いているときは出さない。設定の「使い方」の欄に置く。#72
 */
export function InstallGuideButton() {
  const [open, setOpen] = useState(false);
  if (currentPlatform() === "desktop" || currentStandalone()) return null;
  return (
    <>
      <RowButton className="text-ink" onClick={() => setOpen(true)}>
        <span className="flex-1">ホーム画面に追加する</span>
      </RowButton>
      {open && <InstallGuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}
