import path from "path"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

function inlineCSS() {
  return {
    name: 'inline-css',
    apply: 'build' as const,
    enforce: 'post' as const,
    generateBundle(_output: any, bundle: any) {
      const cssFiles = Object.keys(bundle).filter((f) => f.endsWith('.css'))
      if (cssFiles.length === 0) return
      const css = cssFiles.map((f) => bundle[f].source).join('\n')
      const htmlFile = Object.keys(bundle).find((f) => f.endsWith('.html'))
      if (!htmlFile) return
      let html = bundle[htmlFile].source.toString()
      html = html.replace(/<link[^>]*rel="stylesheet"[^>]*>/g, `<style>${css}</style>`)
      bundle[htmlFile].source = html
      cssFiles.forEach((f) => delete bundle[f])
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: '/',
  plugins: [react(), inlineCSS()],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom', 'gsap'],
            charts: ['recharts'],
          },
      },
    },
  },
});
