import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    chunkSizeWarningLimit: 1000, // Increase from default 500 KB to 1000 KB
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8801',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/public': {
        target: 'http://localhost:8801',
        changeOrigin: true,
      },
    },
  },
})
