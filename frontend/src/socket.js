// 引入Socket.io客户端
import { io } from 'socket.io-client'

// 创建socket实例
const socket = io('/', {
  autoConnect: false,// 禁止自动连接，在socket实例上添加了connect方法，用于手动连接
  transports: ['websocket', 'polling'], // 优先使用websocket
  path: '/socket.io', // socket.io服务器地址
})

// 添加自定义的connect方法
const origConnect = socket.connect.bind(socket) //bind的作用是将connect方法绑定到socket实例上。
socket.connect = () => {// 重写connect方法
  const token = localStorage.getItem('werewolf_token')// 获取token
  socket.auth = token ? { token } : {}// 设置socket.auth属性为token  socket.auth是Socket.IO 支持在连接阶段携带认证信息。
  return origConnect()// 调用原connect方法
}

// 监听connect_error事件
socket.on('connect_error', (err) => {
  if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_FAILED') {
    console.error('[socket] Authentication failed:', err.message)
    localStorage.removeItem('werewolf_token')
    localStorage.removeItem('werewolf_user')
    window.location.href = '/login'
  }
})

socket.on('error', (err) => {
  console.error('[socket] Server error:', err?.message || err)//如果 err 有 message ↓ 使用 message否则  ↓  使用 err 本身
})

// 监听强制登出事件
socket.on('force_logout', (data) => {
  console.warn('[socket] Force logout:', data.message)
  localStorage.removeItem('werewolf_token')
  localStorage.removeItem('werewolf_user')
  const params = new URLSearchParams({
    forceLogout: '1',
    reason: data.reason || '',
    message: data.message || '',
  })
  window.location.href = `/login?${params.toString()}`
})

// 认证
function authenticate() {
  return new Promise((resolve, reject) => {
    if (socket.connected) {
      resolve({ socketId: socket.id })
      return
    }

    socket.once('authenticated', resolve)
    socket.connect()
  })
}

export { authenticate, socket }
export default socket
