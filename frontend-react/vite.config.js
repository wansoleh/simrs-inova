import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_YII_TARGET || 'http://127.0.0.1:8088',
        changeOrigin: false,
      },
      '/svc': {
        target: process.env.VITE_NODE_TARGET || 'http://127.0.0.1:3001',
        changeOrigin: false,
      },
    },
  },
})
