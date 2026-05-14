import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 9457,
      host: '0.0.0.0',
      strictPort: true,
      allowedHosts: [
        env.VITE_HMR_HOST || 'localhost',
        'localhost',
        '127.0.0.1',
        env.VITE_DEV_HOST || 'localhost'
      ],
      hmr: {
        host: env.VITE_HMR_HOST || 'localhost',
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
  }
})
