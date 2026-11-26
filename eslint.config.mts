import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores, defineConfig } from "eslint/config";

export default defineConfig(
  globalIgnores([
    "node_modules",
    "eslint.config.mts",
    "test-vault",
    "esbuild.config.mjs",
    "vitest.config.mts",
    "version-bump.mjs",
    "versions.json",
    "main.js",
    "package.json",
    "package-lock.json",
    "tsconfig.json",
  ]),
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: {
        projectService: { allowDefaultProject: ["manifest.json"] },
        tsconfigRootDir: import.meta.dirname,
        extraFileExtensions: [".json"],
      },
    },
  },
  ...obsidianmd.configs.recommended,
  {
    files: ["src/**/*.ts"],
    rules: { "obsidianmd/ui/sentence-case": ["warn", { brands: ["Inkwell", "Obsidian", "Keep the Rhythm", "StoryLine", "Bases"] }] },
  },
  {
    // The test stand-in for the `obsidian` module provides `moment` itself, from the copy Obsidian's types depend on.
    files: ["tests/helpers/obsidian.ts"],
    rules: { "@typescript-eslint/no-restricted-imports": "off", "import/no-extraneous-dependencies": "off" },
  },
);
