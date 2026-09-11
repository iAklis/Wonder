import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
    ],
  },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: ["src/ui/**/*.{ts,tsx}", "src/components/ui/**/*.tsx"],
  })),
  {
    files: ["src/**/*.js", "scripts/**/*.mjs", "tests/**/*.mjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        chrome: "readonly",
        browser: "readonly",
        __FIREFOX__: "readonly",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": "off",
      "no-empty": "off",
      "no-useless-escape": "off",
      "no-async-promise-executor": "off",
      "no-case-declarations": "off",
      "no-prototype-builtins": "off",
      "no-constant-condition": "off",
    },
  },
];
