import { toast } from "sonner";
import { Notice } from "@/components/layout/AuthShell";
import { Button } from "@/components/ui/button";
import { detectInAppBrowser } from "@/lib/in-app-browser";

/**
 * ログインと登録の画面で、アプリ内のブラウザーに出す案内。#126、0060
 *
 * Google はアプリに埋め込んだブラウザーからのログインを認めていない。
 * LINE は main.tsx で外のブラウザーへ自動で開き直すので、ここに来るのは開き直せなかったときだけ。
 * ほかのアプリ内のブラウザーには開き直す仕組みが無いので、URL をコピーして開き直してもらう
 */
export function InAppBrowserNotice() {
  if (typeof navigator === "undefined" || !detectInAppBrowser(navigator.userAgent)) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast("URL をコピーしました");
    } catch {
      toast.error("コピーできませんでした。URL を長押しして、コピーしてください。");
    }
  }

  return (
    <Notice role="status" className="flex flex-col items-start gap-2.5">
      <span>Safari か Chrome で開いてください。</span>
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        URL をコピーする
      </Button>
    </Notice>
  );
}
