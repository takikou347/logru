import type { ClientExtension } from "@extensions/client/types";
import { GripVertical, Minus, Plus } from "lucide-react";
import { type PointerEvent as ReactPointerEvent, useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { useGroups, useSetExtensionOrder } from "@/api/common";
import { Button } from "@/components/ui/button";
import { extensionIcon } from "@/lib/extension-visuals";
import { permanentExtensionTiles, useExtensionTileHints, useOrderedEnabledExtensions } from "@/lib/extensions";
import { takeExtensionJustAdded } from "@/lib/recent-extension-adds";
import { useMediaQuery } from "@/lib/use-media-query";
import { usePointerReorder } from "@/lib/use-pointer-reorder";
import { cn } from "@/lib/utils";
import { useSetExtensionEnabled } from "@/modules/settings/extensions-api";
import { FieldMessage } from "./Panel";
import { ResponsiveSheet } from "./ResponsiveSheet";

/** タイルの押す先。nav を持つ拡張はその画面、無ければ拡張の詳細 */
function tileTo(ext: ClientExtension): string {
  return ext.nav?.path ?? `/settings/extensions/${ext.manifest.key}`;
}

/** タイルの名前。拡張が短い名前(tileLabel)を渡していればそれ、無ければ nav の名前、それも無ければ manifest の名前。issue #21 */
function tileLabel(ext: ClientExtension): string {
  return ext.tileLabel ?? ext.nav?.label ?? ext.manifest.label;
}

/**
 * タイルの見た目。丸いガラスの面に、拡張のアイコンを置く。0010、issue #145
 *
 * 色は拡張ごとに変えない。色はグループだけに使う決まり(0056)と、カレンダーで「ふたりの記録」などに
 * 使う色がぶつかっていたため、タイルはテーマカラー 1 色にそろえる。issue #15
 * hint は拡張の約束に任意で足す短い字。例は家計簿の今月の合計
 */
function TileFace({ extKey, hint }: { extKey: string; hint?: string }) {
  const Icon = extensionIcon(extKey);
  return (
    <span className="glass relative grid size-16 shrink-0 place-items-center rounded-full" aria-hidden="true">
      <span className="grid size-10 place-items-center rounded-full bg-primary/15">
        <Icon className="size-5 text-primary" />
      </span>
      {hint && (
        <span className="absolute -bottom-1 max-w-[92%] truncate rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
          {hint}
        </span>
      )}
    </span>
  );
}

/**
 * いつも足された状態の拡張、または編集していないときの、押せるタイル。
 * 「機能を足す」画面から足した直後は、縮みながら並びへ入る動き(item-enter)を 1 度だけ付ける。0044、0048、0058
 */
function ExtensionLinkTile({
  ext,
  hint,
  onNavigate,
}: {
  ext: ClientExtension;
  hint?: string;
  onNavigate?: () => void;
}) {
  const [entering] = useState(() => takeExtensionJustAdded(ext.manifest.key));
  return (
    <Link
      to={tileTo(ext)}
      onClick={onNavigate}
      data-testid={`extension-tile-${ext.manifest.key}`}
      className={cn(
        "flex min-w-0 flex-col items-center gap-1.5 text-center text-ink no-underline",
        entering && "item-enter",
      )}
    >
      <TileFace extKey={ext.manifest.key} hint={hint} />
      <span className="w-full truncate text-[11px] font-medium">{tileLabel(ext)}</span>
    </Link>
  );
}

/**
 * 編集の状態の 1 タイル。持ち手で並べ替え、`−` で外す。0058
 *
 * 見た目の丸いボタン(高さ 36px)は変えず、押せる範囲だけ `::before` で 44px に広げる。決定 0012。issue #119
 * 幅は 4 列に収める制約で、隣のボタンとの隙間(4px)までしか広げられない。決定 0058 の「困ること」のとおり、
 * 幅は 44px に届かないが、高さと、届く範囲の幅は広げる
 */
function EditableTile({
  ext,
  hint,
  dragging,
  dragOffset,
  onHandlePointerDown,
  onRemove,
}: {
  ext: ClientExtension;
  hint?: string;
  dragging: boolean;
  dragOffset: { x: number; y: number } | null;
  onHandlePointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
  onRemove: () => void;
}) {
  const label = tileLabel(ext);
  return (
    <div
      data-testid={`extension-tile-${ext.manifest.key}`}
      className={cn("flex min-w-0 flex-col items-center gap-1.5 text-center", dragging && "relative z-20")}
      style={dragOffset ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` } : undefined}
    >
      <TileFace extKey={ext.manifest.key} hint={hint} />
      <span className="w-full truncate text-[11px] font-medium text-ink-2">{label}</span>
      <div className="flex w-full gap-1">
        <button
          type="button"
          data-testid="tile-drag-handle"
          aria-label={`${label}を並べ替える`}
          onPointerDown={onHandlePointerDown}
          className="relative flex h-9 flex-1 touch-none items-center justify-center rounded-full bg-field text-ink-2 before:absolute before:-inset-y-1 before:inset-x-[-2px] before:content-[''] active:cursor-grabbing"
        >
          <GripVertical className="size-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`${label}を外す`}
          onClick={onRemove}
          className="relative flex h-9 flex-1 items-center justify-center rounded-full bg-field text-sun before:absolute before:-inset-y-1 before:inset-x-[-2px] before:content-['']"
        >
          <Minus className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

/** 点線の「+」。押すと「機能を足す」画面へ */
function AddTile({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Link
      to="/settings/extensions/add"
      onClick={onNavigate}
      aria-label="機能を足す"
      data-tour="extension-add"
      className="flex min-w-0 flex-col items-center gap-1.5 text-center text-ink-2 no-underline"
    >
      <span className="grid size-16 shrink-0 place-items-center rounded-full border-2 border-dashed border-line text-ink-3">
        <Plus className="size-6" aria-hidden="true" />
      </span>
      <span className="w-full truncate text-[11px] font-medium">足す</span>
    </Link>
  );
}

/** 外す確認のシート。データは消えないことを伝える */
function RemoveExtensionSheet({
  label,
  pending,
  onCancel,
  onConfirm,
}: {
  label: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <ResponsiveSheet title={`${label}を外しますか`} onClose={onCancel}>
      <FieldMessage>記録は消えません。また足すと戻ります。</FieldMessage>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          やめる
        </Button>
        <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
          外す
        </Button>
      </div>
    </ResponsiveSheet>
  );
}

/**
 * 機能のタイルの並び。丸いガラスのアイコンを 4 列に並べ、最後に「+」を置く。issue #145、0058
 *
 * 機能のシート(スマホ)と、設定の「機能」の両方がこの部品を使い、同じ並びにする。
 * いつも足された状態の拡張(外部のカレンダーなど)は先頭に固定し、並べ替え・外すの対象にしない。
 * 「並びを変える」で編集の状態にすると、持ち手のドラッグ(#121 と同じ Pointer Events の仕組み)か、
 * 各タイルの持ち手ボタンで並べ替えられ、`−` で外せる。並べ替えも外すも、押した瞬間に保存する。
 */
export function ExtensionTileGrid({ onNavigate }: { onNavigate?: () => void }) {
  const groups = useGroups();
  const personalGroupId = groups.data?.find((g) => g.isPersonal)?.id ?? null;
  const permanent = permanentExtensionTiles();
  const removable = useOrderedEnabledExtensions();
  const hints = useExtensionTileHints();
  const reorder = useSetExtensionOrder();
  const setEnabled = useSetExtensionEnabled();
  const [editing, setEditing] = useState(false);
  const [removing, setRemoving] = useState<ClientExtension | null>(null);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  const move = (from: number, to: number) => {
    if (to < 0 || to >= removable.length) return;
    const next = removable.map((x) => x.manifest.key);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item!);
    reorder.mutate(next);
  };
  const { drag, registerSlot, onHandlePointerDown } = usePointerReorder(removable.length, !editing, move);

  // 足した機能は、グループを読み終えるまで分からない。先に並びを出すと、固定のタイルだけが並んで後から増える。
  // 読み終えるまでは、同じ大きさの淡い丸を並べて待つ
  if (!groups.data) {
    return (
      <div data-testid="extension-tile-grid-loading" aria-busy="true" className="grid grid-cols-4 gap-x-2 gap-y-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="mx-auto size-16 rounded-full bg-field" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      {(editing || removable.length > 0) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => setEditing((e) => !e)}>
            {editing ? "完了" : "並びを変える"}
          </Button>
        </div>
      )}
      <div data-testid="extension-tile-grid" className="grid grid-cols-4 gap-x-2 gap-y-4">
        {permanent.map((x) => (
          <ExtensionLinkTile key={x.manifest.key} ext={x} hint={hints[x.manifest.key]} onNavigate={onNavigate} />
        ))}
        {removable.map((x, i) => (
          <div
            key={x.manifest.key}
            ref={registerSlot(i)}
            className={cn(
              "rounded-full",
              drag &&
                drag.overIndex === i &&
                drag.index !== i &&
                "outline-2 outline-dashed outline-primary outline-offset-4",
            )}
          >
            {editing ? (
              <EditableTile
                ext={x}
                hint={hints[x.manifest.key]}
                dragging={drag?.index === i}
                dragOffset={drag?.index === i && !reduceMotion ? { x: drag.dx, y: drag.dy } : null}
                onHandlePointerDown={onHandlePointerDown(i)}
                onRemove={() => setRemoving(x)}
              />
            ) : (
              <ExtensionLinkTile ext={x} hint={hints[x.manifest.key]} onNavigate={onNavigate} />
            )}
          </div>
        ))}
        <AddTile onNavigate={onNavigate} />
      </div>
      {removing && personalGroupId && (
        <RemoveExtensionSheet
          label={tileLabel(removing)}
          pending={setEnabled.isPending}
          onCancel={() => setRemoving(null)}
          onConfirm={() => {
            const label = tileLabel(removing);
            setEnabled.mutate(
              { groupId: personalGroupId, key: removing.manifest.key, enabled: false },
              {
                onSuccess: () => {
                  toast(`${label}を外しました`);
                  setRemoving(null);
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}
