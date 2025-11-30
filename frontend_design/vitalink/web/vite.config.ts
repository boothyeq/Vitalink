import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import path from "path"

export default defineConfig(async () => {
  return {
    server: {
      host: "::",
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
    },
    base: process.env.PAGES_BASE || (process.env.GITHUB_REPOSITORY ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/` : '/'),
    plugins: [react()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})