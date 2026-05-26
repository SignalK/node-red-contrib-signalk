import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier/flat";
import tseslint from "typescript-eslint";

const unusedVarsRule = [
  "error",
  {
    argsIgnorePattern: "^_",
    varsIgnorePattern: "^(?:_|debug)$",
    caughtErrorsIgnorePattern: "^_",
  },
];

export default tseslint.config(
  { ignores: ["node_modules/**", "dist/**"] },
  {
    files: ["**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ...js.configs.recommended.languageOptions,
      sourceType: "module",
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": unusedVarsRule,
      "no-undef": "off",
    },
  },
  {
    files: ["**/*.ts"],
    extends: [tseslint.configs.recommended],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": unusedVarsRule,
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-require-imports": "off",
      "@typescript-eslint/no-this-alias": "off",
    },
  },
  prettier,
);
