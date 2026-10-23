import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 只给 Vite 开发服务器做反向代理，不要用 VITE_ 前缀，否则会被打进浏览器包。
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:3001'

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
