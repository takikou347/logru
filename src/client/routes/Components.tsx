import "../styles/app.css";
import { useState } from "react";
import { ACCENT_COLORS, GROUP_COLORS } from "../../shared/colors";
import { Field, Segmented, Swatches, Toggle } from "../ui/controls";
import { Pools } from "../ui/Pools";
import { useToast } from "../ui/Toast";

/** 部品見本。F-12。開発のときだけ出す */
export function Components() {
  const toast = useToast();
  const [toggle, setToggle] = useState(true);
  const [seg, setSeg] = useState<"month" | "week" | "day">("month");
  const [color, setColor] = useState("wakatake");
  const [accent, setAccent] = useState("aizumi");
  return (
    <main className="app" style={{ maxWidth: 960 }}>
      <Pools colors={["wakatake", "yamabuki", "asagi"]} />
      <h1 style={{ fontSize: 32, fontWeight: 800 }}>部品見本</h1>
      <section className="panel glass">
        <h2>ボタン</h2>
        <div className="wrap">
          <button type="button" className="btn primary">
            <span className="plus">＋</span>予定を足す
          </button>
          <button type="button" className="btn glassy">
            招待リンクを作る
          </button>
          <button type="button" className="btn ghost">
            やめる
          </button>
          <button type="button" className="btn danger">
            予定を消す
          </button>
          <button type="button" className="btn primary" disabled>
            使えない
          </button>
        </div>
      </section>
      <section className="panel glass">
        <h2>入力</h2>
        <Field label="題名" hint="例: 歯医者">
          {(p) => <input {...p} className="input" placeholder="例: 歯医者" />}
        </Field>
        <Field label="題名" error="題名を入れてください。">
          {(p) => <input {...p} className="input" />}
        </Field>
      </section>
      <section className="panel glass">
        <h2>切り替え</h2>
        <div className="wrap">
          <button type="button" className="chip" aria-pressed="true">
            すべて
          </button>
          <button type="button" className="chip" aria-pressed="false">
            <span className="dot c-yamabuki" />
            ふたり
          </button>
        </div>
        <Segmented label="表示の単位" value={seg} onChange={setSeg} options={[{ value: "month", label: "月" }, { value: "week", label: "週" }, { value: "day", label: "日" }]} />
        <div className="line">
          終日
          <Toggle checked={toggle} onChange={setToggle} label="終日" />
        </div>
      </section>
      <section className="panel glass">
        <h2>色</h2>
        <Swatches label="グループの色" value={color} onChange={setColor} options={GROUP_COLORS} />
        <Swatches label="テーマカラー" value={accent} onChange={setAccent} options={ACCENT_COLORS} />
      </section>
      <section className="panel glass">
        <h2>知らせと空の状態</h2>
        <button type="button" className="btn glassy" onClick={() => toast({ message: "予定を保存しました" })}>
          知らせを出す
        </button>
        <div className="empty">
          足せる拡張はまだありません。
          <br />
          予定はいつも使えます。
        </div>
      </section>
    </main>
  );
}
