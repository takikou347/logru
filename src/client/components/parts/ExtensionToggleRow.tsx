import type { ReactNode } from "react";
import { PanelRow } from "@/components/parts/Panel";
import { Switch } from "@/components/ui/switch";

/**
 * 拡張の切り替えの 1 行。グループ設定の「機能」タブと、機能の設定の「使うグループ」が同じ部品を使う。0019、#102
 *
 * 切り替えられるのは、その場所の管理者だけ。管理者でなければ切り替えを出さず、状態だけを見せる。
 */
export function ExtensionToggleRow({
  icon,
  label,
  sub,
  checked,
  canToggle,
  pending,
  onToggle,
}: {
  icon?: ReactNode;
  label: string;
  sub?: string;
  checked: boolean;
  canToggle: boolean;
  pending?: boolean;
  onToggle: (checked: boolean) => void;
}) {
  return (
    <PanelRow>
      <span className="flex items-center gap-2 py-2">
        {icon}
        <span>
          {label}
          {sub && (
            <>
              <br />
              <span className="text-xs text-ink-2">{sub}</span>
            </>
          )}
        </span>
      </span>
      {canToggle ? (
        <Switch checked={checked} aria-label={label} disabled={pending} onCheckedChange={onToggle} />
      ) : (
        <span className="text-xs text-ink-2">{checked ? "使っています" : "使っていません"}</span>
      )}
    </PanelRow>
  );
}
