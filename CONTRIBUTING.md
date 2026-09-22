# CONTRIBUTING

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

## 手元の確認

`lefthook install` で、コミット前と push 前に機械で確かめる仕組みが入る。`pnpm install` の `prepare` で自動でも入る。

| タイミング | 流すもの |
| --- | --- |
| pre-commit | 変えたファイルだけ `biome check --write` |
| pre-push | `pnpm typecheck` と `pnpm test` |

E2E は時間がかかるため手元のフックには入れていない。CI で確かめる。

大きく入れ替えたら `pnpm knip` を流し、使っていない export、ファイル、依存が残っていないか確かめる。
