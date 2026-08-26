// 引入Socket.io客户端
import { io } from 'socket.io-client'
import { getAccessToken, refreshAccessToken, clearTokens } from './utils/auth'

// 创建socket实例
// W22: 显式配置重连参数，避免默认值不适用生产环境
const socket = io(import.meta.env.VITE_API_URL || '/', {
  autoConnect: false,// 禁止自动连接，在socket实例上添加了connect方法，用于手动连接
  transports: ['websocket', 'polling'], // 优先使用websocket
  path: '/socket.io', // socket.io服务器地址
  reconnection: true, // W22: 启用断线重连
  reconnectionAttempts: 10, // W22: 最多重连 10 次
  reconnectionDelay: 1000, // W22: 首次重连延迟 1s
  reconnectionDelayMax: 10000, // W22: 重连延迟上限 10s
})

// 添加自定义的connect方法
const origConnect = socket.connect.bind(socket) //bind的作用是将connect方法绑定到socket实例上。
socket.connect = () => {// 重写connect方法
  const token = getAccessToken()// 获取最新 access token
  socket.auth = token ? { token } : {}// 设置socket.auth属性为token  socket.auth是Socket.IO 支持在连接阶段携带认证信息。
  return origConnect()// 调用原connect方法
}

// 监听connect_error事件
socket.on('connect_error', (err) => {
  if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_FAILED') {
    console.error('[socket] Authentication failed:', err.message)
    // 先尝试刷新 access token 再重连，失败才跳登录
    refreshAccessToken()
      .then(() => {
        socket.auth = { token: getAccessToken() }
        socket.connect()
      })
      .catch(() => {
        clearTokens()
        window.location.href = '/login'
      })
  }
})

socket.on('error', (err) => {
  console.error('[socket] Server error:', err?.message || err)//如果 err 有 message ↓ 使用 message否则  ↓  使用 err 本身
})

// 监听强制登出事件
socket.on('force_logout', (data) => {
  console.warn('[socket] Force logout:', data.message)
  clearTokens()
  const params = new URLSearchParams({
    forceLogout: '1',
    reason: data.reason || '',
    message: data.message || '',
  })
  window.location.href = `/login?${params.toString()}`
})

// W26: 认证 - 统一无参签名、增加超时与错误处理
function authenticate() {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve({ socketId: socket.id })
      return
    }

    let settled = false
    let timeoutId = null

    const onAuthenticated = (payload) => {
      if (settled) return
      settled = true
      cleanup()
      resolve(payload || { socketId: socket.id })
    }

    const onConnectError = (err) => {
      if (settled) return
      // 仅在认证失败场景下 reject（其它 connect_error 由重连机制处理）
      if (err && (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_FAILED')) {
        settled = true
        cleanup()
        reject(err)
      }
    }

    const cleanup = () => {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      socket.off('authenticated', onAuthenticated)
      socket.off('connect_error', onConnectError)
    }

    // W26: 15s 超时兜底，避免 promise 永久挂起
    timeoutId = setTimeout(() => {
      if (settled) return
      settled = true
      cleanup()
      reject(new Error('AUTH_TIMEOUT'))
    }, 15000)

    socket.on('authenticated', onAuthenticated)
    socket.on('connect_error', onConnectError)
    socket.connect()
  })
}

export { authenticate, socket }
export default socket
