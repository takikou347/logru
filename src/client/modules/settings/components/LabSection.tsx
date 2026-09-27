import { Fragment, useState } from "react";
import { Link } from "react-router";
import { useMe } from "@/api/common";
import { FieldMessage, Panel, PanelRow, rowClass } from "@/components/parts/Panel";
import { Switch } from "@/components/ui/switch";
import { isLabEnabled, LAB_EXPERIMENTS, setLabEnabled } from "@/lib/lab";
import { cn } from "@/lib/utils";

/**
 * 設定の「ラボ」。`要確認` の見た目を staging と手元の開発だけで試す。0038、0039、F-35
 * GET /api/me の showLab が true のときだけ出す。本番は showLab がいつも false で出ない
 */
export function LabSection() {
  const me = useMe();
  if (!me.data?.showLab) return null;
  return <LabPanel />;
}

/** 欄の中身。hook を条件の外で呼ぶため、showLab の判定と分けて置く */
function LabPanel() {
  const [enabled, setEnabled] = useState(() =>
    Object.fromEntries(LAB_EXPERIMENTS.map((ex) => [ex.key, isLabEnabled(ex.key)])),
  );

  function toggle(key: string, next: boolean) {
    setLabEnabled(key, next);
    LAB_EXPERIMENTS.find((ex) => ex.key === key)?.apply(next);
    setEnabled((prev) => ({ ...prev, [key]: next }));
  }

  return (
    <Panel title="ラボ">
      <FieldMessage>試している見た目です。入り切りはこの端末に残り、既定は切です。</FieldMessage>
      <div>
        {LAB_EXPERIMENTS.map((ex) => (
          <Fragment key={ex.key}>
            <PanelRow>
              <span className="py-2">
                {ex.label}
                <br />
                <span className="text-xs text-ink-2">{ex.description}</span>
              </span>
              <Switch checked={enabled[ex.key]} aria-label={ex.label} onCheckedChange={(v) => toggle(ex.key, v)} />
            </PanelRow>
            {ex.enabledLink && enabled[ex.key] && (
              <Link to={ex.enabledLink.to} className={cn(rowClass, "no-underline")}>
                <span className="flex-1">{ex.enabledLink.label}</span>
                <span className="text-lg text-ink-3" aria-hidden="true">
                  ›
                </span>
              </Link>
            )}
          </Fragment>
        ))}
      </div>
    </Panel>
  );
}
