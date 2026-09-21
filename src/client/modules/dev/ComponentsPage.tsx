import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ACCENT_COLORS, GROUP_COLORS } from "../../../shared/colors";
import { Chip } from "@/components/Chip";
import { ColorSwatches } from "@/components/ColorSwatches";
import { Field } from "@/components/Field";
import { Dot, Empty, Panel, PanelRow } from "@/components/Panel";
import { Pools } from "@/components/Pools";
import { Segmented } from "@/components/Segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

/** 部品見本。開発のときだけ `/_components` に出す */
export function ComponentsPage() {
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState<"month" | "week" | "day">("month");
  const [color, setColor] = useState("wakatake");
  const [accent, setAccent] = useState("aizumi");
  return (
    <main className="mx-auto flex max-w-[960px] flex-col gap-3 p-4">
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <h1 className="text-[32px] font-extrabold">部品見本</h1>
      <Panel title="ボタン">
        <div className="flex flex-wrap gap-2">
          <Button>
            <Plus className="size-5" />
            予定を足す
          </Button>
          <Button variant="secondary">招待リンクを作る</Button>
          <Button variant="ghost">やめる</Button>
          <Button variant="danger">予定を消す</Button>
          <Button variant="destructive">アカウントを消す</Button>
          <Button disabled>使えない</Button>
        </div>
      </Panel>
      <Panel title="入力">
        <Field label="題名" hint="例: 歯医者">
          {(p) => <Input {...p} placeholder="例: 歯医者" />}
        </Field>
        <Field label="題名" error="題名を入れてください。">
          {(p) => <Input {...p} />}
        </Field>
      </Panel>
      <Panel title="切り替え">
        <div className="flex flex-wrap gap-2">
          <Chip aria-pressed>すべて</Chip>
          <Chip aria-pressed={false}>
            <Dot color="yamabuki" />
            ふたり
          </Chip>
        </div>
        <Segmented
          label="表示の単位"
          value={seg}
          onChange={setSeg}
          options={[
            { value: "month", label: "月" },
            { value: "week", label: "週" },
            { value: "day", label: "日" },
          ]}
        />
        <PanelRow>
          終日
          <Switch checked={toggle} onCheckedChange={setToggle} aria-label="終日" />
        </PanelRow>
      </Panel>
      <Panel title="色">
        <ColorSwatches label="グループの色" value={color} onChange={setColor} options={GROUP_COLORS} />
        <ColorSwatches label="テーマカラー" value={accent} onChange={setAccent} options={ACCENT_COLORS} />
      </Panel>
      <Panel title="知らせと空の状態">
        <Button variant="secondary" className="self-start" onClick={() => toast("予定を保存しました")}>
          知らせを出す
        </Button>
        <Empty>
          足せる拡張はまだありません。
          <br />
          予定はいつも使えます。
        </Empty>
      </Panel>
    </main>
  );
}
