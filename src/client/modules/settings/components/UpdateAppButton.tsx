import { toast } from "sonner";
import { PanelRow, RowButton } from "@/components/parts/Panel";
import { hardResetAndReload } from "@/lib/pwa-reset";

/**
 * いまの版と「アプリを最新にする」。表示が古いままのときに押す。
 *
 * Service Worker の登録と Cache Storage を全部消し、「/」へ移る。ログインの状態と端末の設定は消えない。
 * `/api/reset` と同じことをするが、こちらはログインしたまま押せる。設定の「使い方」の欄に置く。F-42、0089
 */
export function UpdateAppButton() {
  return (
    <>
      <PanelRow>
        <span>いまの版</span>
        <span className="font-mono text-xs text-ink-2">{__APP_VERSION__}</span>
      </PanelRow>
      <RowButton
        className="text-ink"
        onClick={() => {
          toast("最新の版にしています…");
          void hardResetAndReload();
        }}
      >
        <span className="flex-1">アプリを最新にする</span>
      </RowButton>
    </>
  );
}
