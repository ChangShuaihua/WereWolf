import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

const apiTarget = process.env.VITE_API_URL || 'http://localhost:3001'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: '0.0.0.0',
    port: 5172,
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
      '/socket.io': {
        target: apiTarget,
        ws: true,
        changeOrigin: true,
      },
    },
  },
})
