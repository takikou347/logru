import { useState } from "react";
import { InstallGuideSheet } from "@/components/parts/InstallGuideSheet";
import { Button } from "@/components/ui/button";
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
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        ホーム画面に追加する
      </Button>
      {open && <InstallGuideSheet onClose={() => setOpen(false)} />}
    </>
  );
}
