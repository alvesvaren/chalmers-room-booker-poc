import { defineConfig } from "@hey-api/openapi-ts";
import { API_BASE } from "./src/config/api";

export default defineConfig({
  input:
    `${API_BASE}/openapi`,
  output: "src/client",
  plugins: [
    "@hey-api/client-fetch",
    {
      name: "@tanstack/react-query",
      queryOptions: true,
      mutationOptions: true,
    },
  ],
});
