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
    if (err.response?.status === 401) {
      localStorage.removeItem('werewolf_token')
      localStorage.removeItem('werewolf_user')
      router.push('/login')
    }
    return Promise.reject(err)
  }
)

export default api
