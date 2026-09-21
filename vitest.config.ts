import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // 画面のコードと同じく、@ を src/client に向ける
  resolve: { alias: { "@": fileURLToPath(new URL("./src/client", import.meta.url)) } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
