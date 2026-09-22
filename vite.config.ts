import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3050,
    strictPort: false, // se 3050 estiver ocupada, tenta 3051+, nunca 3000
  },
  preview: {
    port: 3050,
    strictPort: false,
  },
  build: {
    emptyOutDir: true,
  },
})