import { Compass, Copy, EllipsisVertical, House, type LucideIcon, Plus, Share } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { currentPlatform, type InstallPlatform, promptInstall, useCanPromptInstall } from "@/lib/pwa";
import { FieldMessage } from "./Panel";
import { ResponsiveSheet } from "./ResponsiveSheet";

/** 手順の 1 行。押す場所の絵と文 */
type Step = { icon: LucideIcon; text: string };

/** 端末ごとの手順 */
const STEPS: Record<Exclude<InstallPlatform, "desktop">, Step[]> = {
  "ios-safari": [
    { icon: Share, text: "画面の下にある共有のボタンを押します。iPad では右上にあります" },
    { icon: Plus, text: "一覧を下へ流し、「ホーム画面に追加」を選びます" },
    { icon: House, text: "右上の「追加」を押すと、ホーム画面に Logru が並びます" },
  ],
  "ios-other": [
    { icon: Copy, text: "下のボタンで、このページのリンクをコピーします" },
    { icon: Compass, text: "Safari を開き、アドレス欄にリンクを貼って開きます" },
    { icon: Share, text: "共有のボタンから「ホーム画面に追加」を選びます" },
  ],
  android: [
    { icon: EllipsisVertical, text: "Chrome の右上のメニューを押します" },
    { icon: Plus, text: "「ホーム画面に追加」か「アプリをインストール」を選びます" },
    { icon: House, text: "「インストール」を押すと、ホーム画面に Logru が並びます" },
  ],
};

/**
 * ホーム画面に追加する手順のシート。端末に合う手順だけを出す。F-34、0036
 * 上の帯、設定の知らせの欄、設定の「ホーム画面に追加する」から開く
 */
export function InstallGuideSheet({ onClose }: { onClose: () => void }) {
  const platform = currentPlatform();
  const canPrompt = useCanPromptInstall();

  async function install() {
    if (await promptInstall()) {
      toast("ホーム画面に追加しました");
      onClose();
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      toast("リンクをコピーしました");
    } catch {
      toast.error("コピーできませんでした。アドレス欄のリンクを長押しして、コピーしてください。");
    }
  }

  return (
    <ResponsiveSheet
      title="ホーム画面に追加する"
      description="ホーム画面から開くと、アドレス欄の無い全画面で使えます。iPhone では、通知もホーム画面から開いたときだけ届きます。"
      onClose={onClose}
    >
      {platform === "desktop" ? (
        <FieldMessage>スマホで開くと、ホーム画面に追加できます。</FieldMessage>
      ) : platform === "android" && canPrompt ? (
        <Button onClick={install}>
          <Plus className="size-5" />
          ホーム画面に追加する
        </Button>
      ) : (
        <>
          {platform === "ios-other" && (
            <FieldMessage>iPhone では、Safari で開いたときにホーム画面に追加できます。</FieldMessage>
          )}
          <ol className="flex flex-col gap-2.5">
            {STEPS[platform].map((s) => (
              <li key={s.text} className="flex items-center gap-3 text-[14px] leading-relaxed">
                <span
                  className="flex size-11 flex-none items-center justify-center rounded-2xl border border-(--glass-edge) bg-field"
                  aria-hidden="true"
                >
                  <s.icon className="size-5" />
                </span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          {platform === "ios-other" && (
            <Button variant="secondary" onClick={copyLink}>
              <Copy className="size-4" />
              リンクをコピーする
            </Button>
          )}
        </>
      )}
      <Button variant="ghost" className="self-end" onClick={onClose}>
        閉じる
      </Button>
    </ResponsiveSheet>
  );
}
