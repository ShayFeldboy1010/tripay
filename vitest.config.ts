import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    globals: true,
    server: {
      deps: {
        inline: [],
        external: ["chrono-node", "luxon", "pgsql-ast-parser"],
      },
    },
    deps: {
      optimizer: {
        ssr: {
          exclude: ["chrono-node", "luxon", "pgsql-ast-parser"],
        },
      },
    },
  },
})
