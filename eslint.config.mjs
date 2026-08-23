import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "android/**",
      "supabase/**",
      "scripts/**",
      "next-env.d.ts",
      "**/.kilo/worktrees/**",
      // Legacy web app and mobile app: being replaced by /api/v1 + a thin client
      // in Phase 5. New server, package and lib code is linted strictly.
      "app/(app)/**",
      "app/api/**",
      "apps/**",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/server/supabase",
              importNames: ["createAdminClient", "adminClient", "createUserClient"],
              message:
                "The privileged/admin Supabase clients are server-only. Import them from route handlers or server modules, never from a client component.",
            },
          ],
        },
      ],
    },
  },
];

export default eslintConfig;
