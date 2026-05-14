import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  // Only apply forced domain HMR if we are explicitly in "remote" mode
  const isRemote = mode === 'remote';

  return {
    plugins: [react()],
    server: {
      port: 9457,
      host: '0.0.0.0',
      strictPort: true,
      hmr: isRemote ? {
        host: env.VITE_HMR_HOST,
        clientPort: 443,
        protocol: 'wss'
      } : true,
      proxy: {
        '/api': {
          target: 'http://localhost:9458',
          changeOrigin: true,
        }
      }
    }
  }
})
