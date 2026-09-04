import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginReact from "eslint-plugin-react";
import { defineConfig } from "eslint/config";

export default defineConfig([
  { files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"], plugins: { js }, extends: ["js/recommended"], languageOptions: { globals: globals.browser } },
  tseslint.configs.recommended,
  pluginReact.configs.flat.recommended,
  {
    // This project uses the new automatic JSX runtime. tsconfig.json sets
    // `"jsx": "react-jsx"`, which means React does NOT need to be imported
    // into scope for JSX to compile. The two rules below are otherwise
    // re-enabled by the recommended preset whenever settings.react.version
    // is missing, which is why App.tsx (and every other JSX file) reports
    // `'React' must be in scope when using JSX`.
    settings: {
      react: { version: "detect" },
    },
    rules: {
      "react/react-in-jsx-scope": "off",
      "react/jsx-uses-react": "off",
    },
  },
]);
