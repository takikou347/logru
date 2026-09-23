#!/usr/bin/env bash
# public/icon.svg から PWA のアイコンを書き出す。Chrome のヘッドレスで撮る
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

render() {
  local size="$1" out="$2" pad="$3" src="${4:-$root/public/icon.svg}"
  cat > "$tmp/icon.html" <<HTML
<!doctype html><html><body style="margin:0;background:#e6ece8">
<img src="file://$src" style="display:block;width:${size}px;height:${size}px;${pad}">
</body></html>
HTML
  "$chrome" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size="$size,$size" --screenshot="$out" "file://$tmp/icon.html" >/dev/null 2>&1
  echo "${out#"$root"/}"
}

render 192 "$root/public/icon-192.png" ""
render 512 "$root/public/icon-512.png" ""
render 180 "$root/public/apple-touch-icon.png" ""
# 中身は中央の 60% に収まっているので、マスク用にもそのまま使える
cp "$root/public/icon-512.png" "$root/public/icon-maskable-512.png"

# ホーム画面のアイコンを長押ししたときの近道の絵。#110
render 96 "$root/public/icon-shortcut-new-96.png" "" "$root/public/icon-shortcut-new.svg"
render 96 "$root/public/icon-shortcut-koma-96.png" "" "$root/public/icon-shortcut-koma.svg"
