import { defineConfig } from "vite"
import react from "@vitejs/plugin-react-swc"
import path from "path"

export default defineConfig(async ({ mode }) => {
  let taggerPlugin: any = null
  if (mode === "development") {
    try {
      const mod: any = await import("lovable-tagger")
      if (mod && typeof mod.componentTagger === "function") {
        taggerPlugin = mod.componentTagger()
      }
    } catch {}
  }
  return {
    server: {
      host: "::",
      port: 5173,
      strictPort: true,
    },
    preview: {
      port: 4173,
    },
    plugins: [react(), taggerPlugin].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  }
})