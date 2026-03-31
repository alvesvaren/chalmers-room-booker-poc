import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  input:
    "https://timeedit-api-wrapper-git-v2-alvesvarens-projects.vercel.app/openapi",
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
