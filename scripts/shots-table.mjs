// 前(本番)と後(release)の画面を撮った画像から、PR 本文に貼る表の下書きを作る。README の「画面を撮る」。
//
//   node scripts/shots-table.mjs <前のフォルダ> <後のフォルダ> <置き場> <画像の URL の頭>
//
// - 置き場には、画像を `<名前>-before.png`、`<名前>-after.png` に名前を変えて写す。
//   develop-docs の evidence.sh は画像をフォルダ無しで 1 か所に置くので、前と後の名前が重ならないようにするため
// - 画像の URL の頭は、evidence.sh が出す URL のファイル名より前。
//   例 https://raw.githubusercontent.com/takikou347/logru/refs/heads/evidence/release-2026-w39
// - 表は標準出力に出す。「変わったこと」「見ること」「確かめた結果」の列は空のまま出すので、手で埋める
// - 前に無い画面は、前のフォルダの notes.tsv の理由を書く(例: 本番には無い: 家計簿)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const [beforeDir, afterDir, stageDir, urlBase] = process.argv.slice(2);
if (!urlBase) {
  console.error("使い方: node scripts/shots-table.mjs <前のフォルダ> <後のフォルダ> <置き場> <画像の URL の頭>");
  process.exit(1);
}

/** `名前<TAB>中身` の行を読む。無ければ空 */
function readTsv(file) {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter(Boolean)
    .map((line) => line.split("\t"));
}

const titles = new Map(readTsv(path.join(afterDir, "titles.tsv")));
const beforeNotes = readTsv(path.join(beforeDir, "notes.tsv"));
const pngs = (dir) => (existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(".png")) : []);
// 並びは release.shots.ts の screens の順、その中はスマホのダーク、ライト、PC のライト、ダークの順
const screenOrder = [...titles.keys()];
const variantOrder = ["390-dark", "390-light", "1440-light", "1440-dark"];
const rank = (stem) => {
  const variant = stem.split("-").slice(-2).join("-");
  const screen = stem.split("-").slice(0, -2).join("-");
  return screenOrder.indexOf(screen) * 10 + variantOrder.indexOf(variant);
};
const stems = [...new Set([...pngs(beforeDir), ...pngs(afterDir)].map((f) => f.replace(/\.png$/, "")))].sort(
  (a, b) => rank(a) - rank(b),
);

mkdirSync(stageDir, { recursive: true });
const rows = [];
for (const stem of stems) {
  // stem は `<番号>-<画面>-<幅>-<明るさ>`。後ろの 2 つが幅と明るさ
  const parts = stem.split("-");
  const variant = parts.slice(-2).join("-");
  const screen = parts.slice(0, -2).join("-");
  const cell = (dir, side) => {
    const file = path.join(dir, `${stem}.png`);
    if (!existsSync(file)) return null;
    copyFileSync(file, path.join(stageDir, `${stem}-${side}.png`));
    return `![${stem}-${side}](${urlBase}/${stem}-${side}.png)`;
  };
  const before =
    cell(beforeDir, "before") ??
    (beforeNotes.find(([name]) => name.startsWith(screen))?.[1] || "撮れなかった(notes.tsv を見る)");
  const after = cell(afterDir, "after") ?? "撮れなかった(notes.tsv を見る)";
  const [width, scheme] = variant.split("-");
  const label = `${screen.slice(0, 2)} ${titles.get(screen) ?? screen}、${width === "390" ? "スマホ" : "PC"}・${scheme === "dark" ? "ダーク" : "ライト"}`;
  rows.push(`| ${label} | ${before} | ${after} |  |  |  |`);
}

console.log("| 画面 | 本番(前) | release(後) | 変わったこと | 見ること | 確かめた結果 |");
console.log("| --- | --- | --- | --- | --- | --- |");
for (const row of rows) console.log(row);
console.error(`${rows.length} 行。置き場: ${stageDir}`);
