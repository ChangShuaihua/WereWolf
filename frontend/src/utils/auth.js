import axios from 'axios'

const ACCESS_KEY = 'werewolf_token'
const REFRESH_KEY = 'werewolf_refresh_token'

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY) || ''
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY) || ''
}

export function setTokens({ accessToken, refreshToken }) {
  localStorage.setItem(ACCESS_KEY, accessToken)
  localStorage.setItem(REFRESH_KEY, refreshToken)
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY)
  localStorage.removeItem(REFRESH_KEY)
  localStorage.removeItem('werewolf_user')
}

// 单飞刷新：并发多个 401 时只发一次 /refresh，避免重复请求
let refreshPromise = null

export function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        throw new Error('NO_REFRESH_TOKEN')
      }
      const { data } = await axios.post('/api/auth/refresh', { refreshToken })
      setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken })
      return data.accessToken
    })().finally(() => {
      refreshPromise = null
    })
  }
  return refreshPromise
}
