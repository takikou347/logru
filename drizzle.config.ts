import { defineConfig } from "drizzle-kit";

/** 土台の表と、拡張ごとの表をまとめて移行にする */
export default defineConfig({
  dialect: "sqlite",
  schema: ["./src/server/core/db/schema.ts", "./src/extensions/*/server/schema.ts"],
  out: "./migrations",
});
