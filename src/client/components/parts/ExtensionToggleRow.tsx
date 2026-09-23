import type { ReactNode } from "react";
import { PanelRow } from "@/components/parts/Panel";
import { Button } from "@/components/ui/button";

/**
 * 拡張の足す・外すの 1 行。グループ設定の「機能」タブと、機能の詳細の「足すグループ」が同じ部品を使う。0019、#102、0058
 *
 * 切り替えられるのは、その場所の管理者だけ。管理者でなければボタンを出さず、状態だけを見せる。
 * トグルではなく「足す」「外す」のボタンにする。issue #145
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
        <Button
          type="button"
          variant={checked ? "secondary" : "default"}
          size="sm"
          aria-label={`${label}を${checked ? "外す" : "足す"}`}
          aria-pressed={checked}
          disabled={pending}
          onClick={() => onToggle(!checked)}
        >
          {checked ? "外す" : "足す"}
        </Button>
      ) : (
        <span className="text-xs text-ink-2">{checked ? "足しています" : "足していません"}</span>
      )}
    </PanelRow>
  );
}
