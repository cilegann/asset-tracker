import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9457,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:9458',
        changeOrigin: true,
      }
    }
  }
})
