import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 9457,
    host: '0.0.0.0',
    strictPort: true,
    allowedHosts: ['YOUR_DOMAIN'],
    hmr: {
      host: 'YOUR_DOMAIN',
      clientPort: 443,
      protocol: 'wss'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:9458',
        changeOrigin: true,
      }
    }
  }
})
