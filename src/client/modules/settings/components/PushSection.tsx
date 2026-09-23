import { useEffect, useState } from "react";
import { toast } from "sonner";
import { InstallGuideSheet } from "@/components/parts/InstallGuideSheet";
import { FieldMessage, Panel, PanelRow } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useEnabledExtensions } from "@/lib/extensions";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push";
import { currentPlatform, currentStandalone, needsInstallForPush } from "@/lib/pwa";
import { useInvalidatePushInfo, usePushInfo } from "../api";

/**
 * 設定の「この端末の知らせ」。端末ごとに切り替える。F-23
 * 知らせる拡張を使っているときだけ出す。何を知らせるかは、拡張の notifies で決まる。
 */
export function PushSection() {
  const reasons = useEnabledExtensions().flatMap((x) => (x.notifies ? [x.notifies] : []));
  if (reasons.length === 0) return null;
  return <PushPanel reasons={reasons} />;
}

/** 知らせの欄の中身。hook を条件の外で呼ぶため、分けて置く */
function PushPanel({ reasons }: { reasons: string[] }) {
  const info = usePushInfo();
  const invalidatePush = useInvalidatePushInfo();
  const support = pushSupport();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [guide, setGuide] = useState(false);
  const needsInstall = needsInstallForPush(currentPlatform(), currentStandalone());

  // biome-ignore lint/correctness/useExhaustiveDependencies: info.data は使わないが、読み直すたびにブラウザの購読を取り直したい
  useEffect(() => {
    void currentSubscription().then((s) => setEndpoint(s?.endpoint ?? null));
  }, [info.data]);

  const on = Boolean(endpoint && info.data?.devices.some((d) => d.endpoint === endpoint));

  async function toggle(next: boolean) {
    if (!info.data) return;
    setBusy(true);
    try {
      if (next) await enablePush(info.data);
      else await disablePush(info.data);
      toast(next ? "この端末で通知を受け取ります" : "この端末では通知を受け取りません");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      await invalidatePush();
      setBusy(false);
    }
  }

  return (
    <Panel title="この端末の通知">
      <PanelRow>
        <span className="py-2">
          通知を受け取る
          <br />
          <span className="text-xs text-ink-2">{reasons.join("、")}になったら通知します</span>
        </span>
        <Switch
          checked={on}
          aria-label="この端末で通知を受け取る"
          disabled={!support.ok || needsInstall || busy || !info.data?.publicKey}
          onCheckedChange={toggle}
        />
      </PanelRow>
      {needsInstall ? (
        // iPhone はホーム画面から開いたときだけ知らせを受けられる。先に追加してもらう。F-34、0023
        <>
          <FieldMessage>
            先にホーム画面に追加してください。追加したホーム画面の Logru から開くと、通知を受け取れます。
          </FieldMessage>
          <Button variant="secondary" size="sm" className="self-start" onClick={() => setGuide(true)}>
            ホーム画面に追加する方法
          </Button>
        </>
      ) : (
        !support.ok && <FieldMessage>{support.reason}</FieldMessage>
      )}
      {support.ok && info.data && !info.data.publicKey && <FieldMessage>この環境では通知を送れません。</FieldMessage>}
      {info.data && info.data.devices.length > 0 && (
        <FieldMessage>通知を受け取る端末: {info.data.devices.length} 台</FieldMessage>
      )}
      {guide && <InstallGuideSheet onClose={() => setGuide(false)} />}
    </Panel>
  );
}
