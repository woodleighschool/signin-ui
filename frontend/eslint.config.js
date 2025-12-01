import { defineConfig } from "eslint/config";
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";
import unicornPlugin from "eslint-plugin-unicorn";

export default defineConfig([
  // Global ignores
  {
    ignores: ["dist/**", "build/**", "node_modules/**"],
  },

  // Base language options for all JS/TS files
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    settings: {
      react: { version: "detect" },
    },
  },

  // Core JS rules – now using the strictest core set
  js.configs.recommended,

  // TypeScript – stricter, but still not type-checked
  ...tseslint.configs.strict,
  ...tseslint.configs.stylistic,

  {
    plugins: { react: reactPlugin },
    ...reactPlugin.configs.flat.recommended,
  },
  {
    plugins: { react: reactPlugin },
    ...reactPlugin.configs.flat["jsx-runtime"],
  },
  {
    plugins: { "react-hooks": reactHooksPlugin },
    rules: {
      ...reactHooksPlugin.configs["recommended-latest"].rules,
    },
  },
  //{
  //  plugins: { unicorn: unicornPlugin },
  //  rules: {
  //    ...unicornPlugin.configs.recommended.rules,
  //  },
  //},
  {
    rules: {
      "no-console": "off",
      "no-debugger": "error",
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "curly": ["error", "all"],
      "no-var": "error",
      "prefer-const": ["error", { destructuring: "all" }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["error"],
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: true,
          allowHigherOrderFunctions: true,
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "error",
      "react/prop-types": "off",
    },
  },
]);
