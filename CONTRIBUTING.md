# CONTRIBUTING

人と Claude の両方が読む規約。ファイル名や import の禁止など、機械で見られるものは Biome
(`biome.json`) が見る。ここには、Biome で見ていないものだけ書く。要件、設計、置き場所を決めた
理由は develop-docs の `docs/logru/` にある。実装の前に読む。置き場所の理由は decisions の 0013。

## ファイル名

| 場所 | 形 |
| --- | --- |
| コンポーネント(`.tsx`) | PascalCase.tsx |
| それ以外(`.ts`) | kebab-case.ts |
| `src/client/components/ui` | shadcn/ui が生成したままの名前。変えない |

`src/client/components` と `src/client/modules` 配下は Biome の `useFilenamingConvention` が見る。

## 置き場所

| 場所 | 中身 |
| --- | --- |
| `src/client/app` | 入口、道順、ログインの状態、画面の入口の守り |
| `src/client/modules/<機能>` | 画面。auth、calendar、groups、settings、legal |
| `src/client/components/ui` | shadcn/ui から取ったままの部品 |
| `src/client/components/layout` | ページの外枠、ナビゲーションなど画面全体の骨組み |
| `src/client/components/parts` | 複数の画面で使う、独自の共通部品 |
| `src/server/core` | API の土台。ID トークンの確認、D1 の表の定義 |
| `src/server/modules/<機能>` | API の入り口。me、groups、invites、calendar |
| `src/extensions/<名前>` | `manifest.ts`、`server/`、`client/`、`shared/` |

## API の呼び出し

画面(`*Page.tsx`、`*Sheet.tsx`)から `@/api/client` を直接呼ばない。機能ごとに
`src/client/modules/<機能>/api.ts` を置き、TanStack Query の hook(`useXxx`)にまとめて、
画面はその hook だけを呼ぶ。`src/client/modules/calendar/api.ts` が見本になる。

この禁止は Biome の `noRestrictedImports`(`*Page.tsx`、`*Sheet.tsx` への override)が見る。

## 依存の向き

土台が拡張を読んでよいのは `src/extensions/registry.server.ts` と `registry.client.ts` だけ。
`src/server/` から拡張の中の `client/`、`server/`、`shared/` を直接読まない。この禁止は Biome の
`noRestrictedImports`(`src/server/**` への override)が見る。詳しい理由は 0013。

## 別名(path alias)

| 別名 | 差す場所 |
| --- | --- |
| `@/` | `src/client/` |
| `@shared/` | `src/shared/` |
| `@server/` | `src/server/` |
| `@extensions/` | `src/extensions/` |

`tsconfig.json`(と `tsconfig.app.json`)、`vite.config.ts` の両方に定義がある。別名を足したら両方直す。

## コメントで決定・機能・issue を引く

仕様の理由や由来をコメントに残すときは、decisions の番号(`0009`)、要件の機能 ID(`F-20`)、
GitHub の issue(`#28`)をそのまま書く。文章は書かず、番号だけを添える。

```ts
/** グループ。登録した人には自分だけのグループを 1 つ作る。0009 */
```

```ts
/** カレンダーに出す人の選択。自分の画面だけの設定。hidden が true の人が作った項目を出さない。F-20 */
```

```ts
// 招待する人が、みな予定のグループのメンバーかを確かめる。違う人がいれば 400。#28
```

複数を引くときは読点で並べる(`F-23、0023`)。番号だけでは分からない固有の判断(捨てた案、境界値の理由)は、
コメントではなく `docs/logru/decisions/` に書く。

## コミットの形

`type(scope): 何をしたか` を日本語で書く。scope は省ける。

type は次のいずれか。

| type | 意味 |
| --- | --- |
| feat | 機能を足す |
| fix | 直す |
| docs | 文書だけの変更 |
| test | テストだけの変更 |
| chore | 上のどれにも当たらない雑務 |
| refactor | 動きを変えない整理 |
| build | ビルドや依存まわりの変更 |

## テスト

```bash
pnpm typecheck
pnpm test
pnpm e2e
```

E2E(Playwright)は Firebase Auth エミュレーター(9099)が要る。README の手順に従う。

同時に流すと Mac の負荷が上がり、時間切れで落ちることがある。`pnpm e2e --workers=2` にし、
落ちたファイルだけを 1 つずつ流し直す。ほかに分かっていること。

- Service Worker が出す要求は `page.route` では止められない。`page.context().route` を使う
- Auth エミュレーターの Google の窓は、開いた直後だとボタンが効かないことがある。入力欄が開くまで押し直す
- パスワード再設定の画面は、移り切る前に入れた値が消えることがある。見出しを待ってから入れる

## 手元の確認

`lefthook install` で、コミット前と push 前に機械で確かめる仕組みが入る。`pnpm install` の `prepare` で自動でも入る。

| タイミング | 流すもの |
| --- | --- |
| pre-commit | 変えたファイルだけ `biome check --write` |
| pre-push | `pnpm typecheck` と `pnpm test` |

E2E は時間がかかるため手元のフックには入れていない。CI で確かめる。

大きく入れ替えたら `pnpm knip` を流し、使っていない export、ファイル、依存が残っていないか確かめる。
