import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
