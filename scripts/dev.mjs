// 手元の開発をまとめて立ち上げる。
// 1. 手元の D1 に移行を当てる
// 2. Firebase の Auth エミュレーターを 9099 番で立ち上げる
// 3. Vite を 5173 番で立ち上げる
// エミュレーターが既に動いていれば、それを使う。
// どちらかが止まったら、もう片方も止める。Ctrl+C で両方止まる。
import { spawn, spawnSync } from "node:child_process";
import { connect } from "node:net";

/** その番号で、既に誰かが待ち受けているか */
const listening = (port) =>
  new Promise((resolve) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => resolve(socket.end() && true));
    socket.once("error", () => resolve(false));
  });

const migrate = spawnSync("pnpm", ["-s", "db:migrate:local"], { stdio: "inherit" });
if (migrate.status !== 0) process.exit(migrate.status ?? 1);

const children = [];
if (await listening(9099)) console.log("Auth エミュレーターは既に動いています。それを使います。");
else children.push(spawn("pnpm", ["exec", "firebase", "emulators:start", "--only", "auth", "--project", "demo-logru"], { stdio: "inherit" }));
children.push(spawn("pnpm", ["exec", "vite", ...process.argv.slice(2)], { stdio: "inherit" }));

let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGINT");
  process.exitCode = code;
}

for (const child of children) child.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
