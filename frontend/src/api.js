import axios from 'axios'
import router from './router'
import { getAccessToken, refreshAccessToken, clearTokens } from './utils/auth'

const api = axios.create({
  // In production the Express API is deployed separately from the Vite app.
  baseURL: import.meta.env.VITE_API_URL
    ? `${import.meta.env.VITE_API_URL.replace(/\/$/, '')}/api`
    : '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status
    const url = err.config?.url || ''
    // 登录/注册/刷新接口本身不触发自动刷新，避免死循环
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout')

    if (status === 401 && !isAuthEndpoint && !err.config?._retry) {
      err.config._retry = true
      try {
        // 无感续期：用 refresh token 换新 access token，然后重试原请求
        await refreshAccessToken()
        err.config.headers.Authorization = `Bearer ${getAccessToken()}`
        return api(err.config)
      } catch (refreshErr) {
        clearTokens()
        if (router.currentRoute?.value?.path !== '/login') {
          router.push('/login')
        }
      }
    }
    return Promise.reject(err)
  }
)

export default api
