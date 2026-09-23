import { Smartphone, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  currentPlatform,
  currentStandalone,
  promptInstall,
  readBannerDismissedAt,
  shouldShowInstallBanner,
  useCanPromptInstall,
  writeBannerDismissedAt,
} from "@/lib/pwa";
import { cn } from "@/lib/utils";
import { InstallGuideSheet } from "./InstallGuideSheet";

/**
 * 上の帯の下に出す、ホーム画面に追加する案内の細い帯。F-34、0036
 *
 * スマホのブラウザーで開いているときだけ出す。ホーム画面から開いているとき、PC では出さない。
 * 押すと、Android は追加のダイアログを出し、iPhone は手順のシートを開く。閉じると 30 日は出さない
 */
export function InstallBanner({ className }: { className?: string }) {
  const canPrompt = useCanPromptInstall();
  const [dismissedAt, setDismissedAt] = useState(readBannerDismissedAt);
  const [guide, setGuide] = useState(false);
  const platform = currentPlatform();
  const show = shouldShowInstallBanner({
    platform,
    standalone: currentStandalone(),
    dismissedAt,
    now: Date.now(),
    canPrompt,
  });

  function dismiss() {
    const now = Date.now();
    writeBannerDismissedAt(now);
    setDismissedAt(now);
  }

  async function open() {
    if (platform === "android" && canPrompt) {
      if (await promptInstall()) toast("ホーム画面に追加しました");
      return;
    }
    setGuide(true);
  }

  return (
    <>
      {show && (
        <div
          role="status"
          className={cn(
            "glass flex min-h-10 items-center gap-1 rounded-full py-0.5 pr-0.5 pl-4 text-[12.5px] font-medium",
            className,
          )}
        >
          <Smartphone className="size-4 flex-none text-ink-2" aria-hidden="true" />
          <button
            type="button"
            className="min-h-9 flex-1 px-1.5 text-left underline-offset-2 hover:underline"
            onClick={open}
          >
            ホーム画面に追加すると、アプリのように使えます
          </button>
          <button
            type="button"
            className="flex size-9 flex-none items-center justify-center rounded-full text-ink-2 hover:bg-field"
            aria-label="ホーム画面に追加する案内を閉じる"
            onClick={dismiss}
          >
            <X className="size-4" />
          </button>
        </div>
      )}
      {guide && <InstallGuideSheet onClose={() => setGuide(false)} />}
    </>
  );
}
