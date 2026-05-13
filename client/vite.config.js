import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9457,
    host: true,
    strictPort: true,
    allowedHosts: 'all',
    hmr: {
      clientPort: 443,
    },
    proxy: {
      '/api': {
        target: 'http://localhost:9458',
        changeOrigin: true,
      }
    }
  }
})
