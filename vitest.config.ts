import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // vite.config.ts の define と同じ印。テストでは値そのものは使わない。0040
  define: { __APP_VERSION__: JSON.stringify("test") },
  // 画面のコードと同じく、@ を src/client に向ける
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/client", import.meta.url)),
      "@shared": fileURLToPath(new URL("./src/shared", import.meta.url)),
      "@server": fileURLToPath(new URL("./src/server", import.meta.url)),
      "@extensions": fileURLToPath(new URL("./src/extensions", import.meta.url)),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
