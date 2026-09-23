import { ChevronRight, Users } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { useGroups } from "@/api/common";
import { useEnabledExtensions } from "@/lib/extensions";
import { ExtensionTileGrid } from "./ExtensionTileGrid";
import { ResponsiveSheet } from "./ResponsiveSheet";

/**
 * スマホの機能のシート。下の操作の「機能」で開く。0019、issue #145
 *
 * 上に拡張のすぐする操作、中に足した機能のタイルの並び(ExtensionTileGrid)、下にグループへの道を並べる。
 * PC では左の列が同じ役をするので、開くボタンを出さない。
 */
export function FeatureSheet({ onClose }: { onClose: () => void }) {
  const extensions = useEnabledExtensions();
  const groups = useGroups();
  const shared = (groups.data ?? []).filter((g) => !g.isPersonal).length;
  const actions = extensions.flatMap((x) => x.actions ?? []);
  return (
    <ResponsiveSheet title="機能" onClose={onClose}>
      {actions.length > 0 && (
        <div className="grid gap-2">
          {actions.map((a) => (
            <Link
              key={a.path}
              to={a.path}
              onClick={onClose}
              className="flex min-h-14 items-center gap-3 rounded-[18px] border border-(--glass-edge) bg-field px-4.5 text-base font-bold no-underline"
            >
              <a.icon className="size-5" aria-hidden="true" />
              {a.label}
              {a.hint && <span className="ml-auto text-xs font-medium text-ink-2">{a.hint}</span>}
            </Link>
          ))}
        </div>
      )}
      <ExtensionTileGrid onNavigate={onClose} />
      <ul aria-label="ほかの画面" className="flex flex-col">
        <FeatureRow
          to="/groups"
          icon={<Users className="size-5" />}
          label="グループ"
          sub={shared ? `${shared} つのグループ` : "まだありません"}
          onClick={onClose}
        />
      </ul>
    </ResponsiveSheet>
  );
}

/** 機能のシートの 1 行 */
function FeatureRow({
  to,
  icon,
  label,
  sub,
  onClick,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  sub?: string;
  onClick: () => void;
}) {
  return (
    <li className="border-line not-first:border-t">
      <Link
        to={to}
        onClick={onClick}
        className="grid min-h-15 grid-cols-[40px_1fr_auto] items-center gap-3 no-underline"
      >
        <span
          className="grid size-10 place-items-center rounded-xl border border-line bg-field-strong"
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="flex min-w-0 flex-col">
          <b className="text-[15px]">{label}</b>
          {sub && <small className="truncate text-xs text-ink-2">{sub}</small>}
        </span>
        <ChevronRight className="size-4 text-ink-3" aria-hidden="true" />
      </Link>
    </li>
  );
}
