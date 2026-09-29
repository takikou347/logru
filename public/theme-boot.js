// 描画の前に明るさ、背景のテーマ、テーマカラー、見た目の土台を当て、開いた瞬間のちらつきを防ぐ。0012、issue #50、0090、0095
(function () {
  var mode = "system";
  var bgTheme = null;
  var accent = "aizumi";
  var look = "glass";
  var LOOKS = ["glass", "paper", "water", "night", "wood", "season"];
  try {
    var v = JSON.parse(localStorage.getItem("logru-theme") || "null");
    if (v && v.mode) mode = v.mode;
    if (v && v.bgTheme) bgTheme = v.bgTheme;
    if (v && v.accent) accent = v.accent;
  } catch (e) {}
  // 見た目の土台(紙・リキッドガラス・水・夜空・木・季節)。ラボの「新しい見た目」が入っていなければ
  // tokens.css の側で当たらないので、ここでは値を読むだけで済む。0090、0095
  try {
    var storedLook = localStorage.getItem("logru-look");
    if (LOOKS.indexOf(storedLook) !== -1) look = storedLook;
  } catch (e) {}
  // 選んだ値が無ければ、端末の「透明度を下げる」に合わせた既定にする。#95
  if (!bgTheme) bgTheme = window.matchMedia("(prefers-reduced-transparency: reduce)").matches ? "flat" : "glass";
  var dark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  var root = document.documentElement;
  root.dataset.theme = dark ? "dark" : "light";
  root.dataset.bgTheme = bgTheme;
  root.dataset.accent = accent;
  root.dataset.look = look;
  // 新しい見た目(見た目の土台)を既定で付ける。ラボの「前の見た目に戻す」を入れた人だけ付けない。
  // マウント後でなく起動の最初から付けることで、開いた瞬間のちらつきを防ぐ。0090
  try {
    if (localStorage.getItem("logru:lab:old-look") !== "1") {
      root.setAttribute("data-lab-new-look", "");
    }
  } catch (e) {
    root.setAttribute("data-lab-new-look", "");
  }
  // 季節のテーマの季節(3〜5 春、6〜8 夏、9〜11 秋、12〜2 冬、日本時間)。look が season 以外でも
  // 置いておいて害はない。src/client/lib/look.ts の currentSeason と同じ計算。0095
  try {
    var jpMonth = Number(
      new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Tokyo", month: "numeric" }).format(new Date()),
    );
    root.dataset.season =
      jpMonth >= 3 && jpMonth <= 5
        ? "spring"
        : jpMonth >= 6 && jpMonth <= 8
          ? "summer"
          : jpMonth >= 9 && jpMonth <= 11
            ? "autumn"
            : "winter";
  } catch (e) {}
  // 水の光の揺らぎ、夜空のまたたきを、操作が止まって 5 秒経ったら止める(電池、issue #243)。
  // tokens.css の `:root[data-bg-idle][data-look="water"|"night"]` が animation-play-state を paused
  // にする。ラボの「新しい見た目」を入れていない人には data-look の節が当たらないので、
  // このリスナー自体は常時つけても実害は無い。
  try {
    var idleTimer = null;
    var markActive = function () {
      root.removeAttribute("data-bg-idle");
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(function () {
        root.setAttribute("data-bg-idle", "");
      }, 5000);
    };
    ["pointerdown", "keydown", "scroll", "touchstart"].forEach(function (type) {
      window.addEventListener(type, markActive, { passive: true });
    });
    markActive();
  } catch (e) {}
})();
