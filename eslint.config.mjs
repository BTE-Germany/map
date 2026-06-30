import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // `any` mostly remains at third-party boundaries (maplibre/mapbox events,
      // recharts payloads, motion variants). Surface it as a warning so it is
      // visible on every build for incremental cleanup, instead of blocking the
      // build — but keep it discouraged. Prefer precise types in new/logic code.
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];

export default eslintConfig;
