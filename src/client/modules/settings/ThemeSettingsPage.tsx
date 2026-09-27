import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { Navigate } from "react-router";
import { useGroups, useMe } from "@/api/common";
import { Loading } from "@/app/guards";
import { FieldMessage, Panel } from "@/components/parts/Panel";
import { isLabEnabled } from "@/lib/lab";
import { LOOKS, type Look, useStoredLook } from "@/lib/look";
import { cn } from "@/lib/utils";
import { poolColorsOf } from "../calendar/model";
import { SettingsShell } from "./components/SettingsShell";

/**
 * 設定の「テーマ」。/settings/theme。0090、F-43
 *
 * ラボの「新しい見た目」を入れた人だけに出す。入れていなければ設定・見た目へ戻す。
 * 紙とリキッドガラスの見本を並べ、押した瞬間に画面へ効かせる。選んだ値はこの端末だけに残る
 */
export function ThemeSettingsPage() {
  const me = useMe();
  const groups = useGroups();
  const [look, setLook] = useStoredLook();

  if (!me.data) return <Loading />;
  if (!me.data.showLab || !isLabEnabled("new-look")) return <Navigate to="/settings/appearance" replace />;

  return (
    <SettingsShell title="テーマ" poolColors={poolColorsOf(groups.data ?? [], me.data)} back="/settings/appearance">
      <Panel title="見た目の土台">
        <FieldMessage>
          画面の配置は変わりません。面の色と質感、動きだけが変わります。選んだ見た目はこの端末に残ります。
        </FieldMessage>
        <RadioGroupPrimitive.Root
          value={look}
          onValueChange={(v) => setLook(v as Look)}
          aria-label="見た目の土台"
          className="grid grid-cols-2 gap-3"
        >
          {LOOKS.map((l) => (
            <RadioGroupPrimitive.Item
              key={l.value}
              value={l.value}
              aria-label={l.label}
              className={cn(
                "flex flex-col gap-2 rounded-2xl border-2 border-transparent p-2 text-left outline-none",
                "focus-visible:ring-2 focus-visible:ring-ink",
                "data-[state=checked]:border-ink",
              )}
            >
              <LookPreview look={l.value} />
              <span className="text-sm font-bold">{l.label}</span>
              <span className="text-xs text-ink-2">{l.description}</span>
            </RadioGroupPrimitive.Item>
          ))}
        </RadioGroupPrimitive.Root>
      </Panel>
    </SettingsShell>
  );
}

/**
 * 見本の小さな面。選ぶための見本なので、いま当たっている実際のトークンではなく、
 * 紙とガラスをそれぞれ表す固定した色で描く
 */
function LookPreview({ look }: { look: Look }) {
  return (
    <div
      className={cn(
        "flex h-20 flex-col justify-end gap-1.5 p-3",
        look === "paper"
          ? "rounded-[4px] border border-[#e4d7b8] bg-[#f6eeda] shadow-[0_1px_3px_rgba(36,27,18,0.12)]"
          : "rounded-3xl border border-white/60 bg-gradient-to-b from-white/70 to-white/35 shadow-[0_10px_24px_-12px_rgba(23,32,44,0.35)] backdrop-blur-sm",
      )}
      aria-hidden="true"
    >
      <span className={cn("h-2 w-10 rounded-full", look === "paper" ? "bg-[#8a7a60]/50" : "bg-white/70")} />
      <span className={cn("h-2 w-16 rounded-full", look === "paper" ? "bg-[#8a7a60]/30" : "bg-white/45")} />
    </div>
  );
}
