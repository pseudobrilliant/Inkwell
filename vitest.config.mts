import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Tests run in Node against a small stand-in for the `obsidian` module (tests/helpers/obsidian.ts):
// Obsidian itself only exists inside the app.
export default defineConfig({
  resolve: {
    alias: { obsidian: fileURLToPath(new URL("./tests/helpers/obsidian.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
