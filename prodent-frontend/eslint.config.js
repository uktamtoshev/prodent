import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Lock-in protection: the project uses a self-contained REST proxy at
      // src/integrations/api/client.ts that mimics the Supabase SDK shape.
      // Pulling the real `@supabase/supabase-js` would shadow the proxy and
      // silently break auth, queries, and realtime. Use `import { api }
      // from '@/integrations/api/client'` instead.
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@supabase/supabase-js",
              message:
                "Do not import the real Supabase SDK. Use `import { api } from '@/integrations/api/client'`.",
            },
            {
              name: "@supabase/auth-helpers-react",
              message:
                "Do not import @supabase/* helpers. Use the local `api` client.",
            },
          ],
          patterns: [
            {
              group: ["@/integrations/supabase/*"],
              message:
                "The `integrations/supabase/` folder was renamed to `integrations/api/`. Update your import.",
            },
          ],
        },
      ],
    },
  },
);
