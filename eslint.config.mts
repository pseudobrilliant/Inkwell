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
    "scripts/check-spec-tests.mjs",
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
    // Writing blocks are a self-contained component (openspec/changes/writing-blocks/design.md, decision 10): they
    // import only Obsidian, CodeMirror and each other, and the rest of Inkwell calls into them, never the reverse.
    // The core rule is used because Obsidian's config already sets the TypeScript one.
    files: ["src/writingblock*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["./*", "../*", "!./writingblock*"],
              message: "Writing blocks must not depend on the rest of Inkwell. Have that code call into the block instead.",
            },
          ],
        },
      ],
    },
  },
  {
    // The test stand-in for the `obsidian` module provides `moment` itself, from the copy Obsidian's types depend on.
    files: ["tests/helpers/obsidian.ts"],
    rules: { "@typescript-eslint/no-restricted-imports": "off", "import/no-extraneous-dependencies": "off" },
  },
);
