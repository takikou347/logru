import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PushInfo } from "../../../shared/api-types";
import { FieldMessage, Panel, PanelRow } from "@/components/Panel";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push";

/**
 * 設定の「この端末の知らせ」。端末ごとに切り替える。F-23
 * いま知らせを出すのは、ひとコマの枠の始まりだけ。拡張ごとに、何を知らせるかは拡張の画面で決める。
 */
export function PushSection() {
  const qc = useQueryClient();
  const info = useQuery({ queryKey: ["push"], queryFn: () => api<PushInfo>("/me/push") });
  const support = pushSupport();
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      toast(next ? "この端末で知らせを受けます" : "この端末では知らせを受けません");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      await qc.invalidateQueries({ queryKey: ["push"] });
      setBusy(false);
    }
  }

  return (
    <Panel title="この端末の知らせ">
      <PanelRow>
        <span className="py-2">
          知らせを受ける
          <br />
          <span className="text-xs text-ink-2">ひとコマの時刻になったら知らせます</span>
        </span>
        <Switch checked={on} aria-label="この端末で知らせを受ける" disabled={!support.ok || busy || !info.data?.publicKey} onCheckedChange={toggle} />
      </PanelRow>
      {!support.ok && <FieldMessage>{support.reason}</FieldMessage>}
      {support.ok && info.data && !info.data.publicKey && <FieldMessage>この環境では知らせを送れません。</FieldMessage>}
      {info.data && info.data.devices.length > 0 && <FieldMessage>知らせを受ける端末: {info.data.devices.length} 台</FieldMessage>}
    </Panel>
  );
}
