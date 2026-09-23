import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { Panel } from "@/components/parts/Panel";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { extensionIcon, extensionTileColor } from "../extension-visuals";

/**
 * 設定の「機能」のカード。アイコン、一言、見本の色味、「使う」を並べる。issue #102
 *
 * 見本の画像は用意していないので、拡張ごとに決まる色味とアイコンで代える。ラベルの部分を押すと、その拡張の詳細へ移る。
 * @param toggle 切り替えられる拡張だけ渡す。無ければ、いつも使える拡張として「いつでも使えます」を出す
 */
export function ExtensionCard({
  extKey,
  label,
  description,
  toggle,
}: {
  extKey: string;
  label: string;
  description: string;
  toggle?: { checked: boolean; pending: boolean; disabled: boolean; onToggle: (checked: boolean) => void };
}) {
  const Icon = extensionIcon(extKey);
  const color = extensionTileColor(extKey);
  return (
    <Panel aria-label={label}>
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "grid size-14 flex-none place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--c)_18%,transparent)]",
            `c-${color}`,
          )}
          aria-hidden="true"
        >
          <Icon className="size-6 text-(--c)" />
        </span>
        <Link to={`/settings/extensions/${extKey}`} className="flex min-w-0 flex-1 flex-col no-underline text-ink">
          <span className="text-[17px] font-bold">{label}</span>
          <span className="text-[13px] leading-relaxed text-ink-2">{description}</span>
        </Link>
        {toggle ? (
          <Switch
            checked={toggle.checked}
            aria-label={`${label}を使う`}
            data-tour="extension-toggle"
            disabled={toggle.disabled || toggle.pending}
            onCheckedChange={toggle.onToggle}
          />
        ) : (
          <span className="flex-none text-xs text-ink-2">いつでも使えます</span>
        )}
        <ChevronRight className="size-4 flex-none text-ink-3" aria-hidden="true" />
      </div>
    </Panel>
  );
}
