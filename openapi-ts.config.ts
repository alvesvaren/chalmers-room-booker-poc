import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: 'https://timeedit.svaren.dev/openapi',
  output: 'src/client',
  plugins: [
    '@hey-api/client-fetch',
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      mutationOptions: true,
    },
  ],
})
