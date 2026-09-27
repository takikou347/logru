// 描画の前に明るさ、背景のテーマ、テーマカラーを当て、開いた瞬間のちらつきを防ぐ。0012、issue #50
(function () {
  var mode = "system";
  var bgTheme = null;
  var accent = "aizumi";
  try {
    var v = JSON.parse(localStorage.getItem("logru-theme") || "null");
    if (v && v.mode) mode = v.mode;
    if (v && v.bgTheme) bgTheme = v.bgTheme;
    if (v && v.accent) accent = v.accent;
  } catch (e) {}
  // 選んだ値が無ければ、端末の「透明度を下げる」に合わせた既定にする。#95
  if (!bgTheme) bgTheme = window.matchMedia("(prefers-reduced-transparency: reduce)").matches ? "flat" : "glass";
  var dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.bgTheme = bgTheme;
  root.dataset.accent = accent;
})();
