// 描画の前に明るさとテーマカラーを当て、開いた瞬間のちらつきを防ぐ。0012
(function () {
  var mode = "system";
  var accent = "aizumi";
  try {
    var v = JSON.parse(localStorage.getItem("logru-theme") || "null");
    if (v && v.mode) mode = v.mode;
    if (v && v.accent) accent = v.accent;
  } catch (e) {}
  var dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.accent = accent;
})();
