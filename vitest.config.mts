import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // Resolves the "@/*" -> "./src/*" alias straight from tsconfig.json.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    // Playwright specs live in tests/e2e and are run by `npm run test:e2e`.
    exclude: ["node_modules/**", ".next/**", "tests/e2e/**"],
    setupFiles: ["tests/setup.ts"],
  },
});
