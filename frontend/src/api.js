import axios from 'axios'
import router from './router'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('werewolf_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // W23: 401 拦截排除登录/注册接口；并避免在 /login 页面重复跳转
    if (err.response?.status === 401) {
      const url = err.config?.url || ''
      const isAuthEndpoint = url.includes('/auth/login') || url.includes('/auth/register')
      const isOnLoginPage = router.currentRoute?.value?.path === '/login'
      if (!isAuthEndpoint && !isOnLoginPage) {
        localStorage.removeItem('werewolf_token')
        localStorage.removeItem('werewolf_user')
        router.push('/login')
      }
    }
    return Promise.reject(err)
  }
)

export default api
