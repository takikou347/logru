import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { PushInfo } from "../../../shared/api-types";
import { FieldMessage, Panel, PanelRow } from "@/components/Panel";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/api";
import { useEnabledExtensions } from "@/lib/extensions";
import { currentSubscription, disablePush, enablePush, pushSupport } from "@/lib/push";

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
      toast(next ? "この端末で通知を受け取ります" : "この端末では通知を受け取りません");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      await qc.invalidateQueries({ queryKey: ["push"] });
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
        <Switch checked={on} aria-label="この端末で通知を受け取る" disabled={!support.ok || busy || !info.data?.publicKey} onCheckedChange={toggle} />
      </PanelRow>
      {!support.ok && <FieldMessage>{support.reason}</FieldMessage>}
      {support.ok && info.data && !info.data.publicKey && <FieldMessage>この環境では通知を送れません。</FieldMessage>}
      {info.data && info.data.devices.length > 0 && <FieldMessage>通知を受け取る端末: {info.data.devices.length} 台</FieldMessage>}
    </Panel>
  );
}
