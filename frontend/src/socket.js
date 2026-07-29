import { io } from 'socket.io-client'

const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  path: '/socket.io',
})

const origConnect = socket.connect.bind(socket)
socket.connect = () => {
  const token = localStorage.getItem('werewolf_token')
  socket.auth = token ? { token } : {}
  return origConnect()
}

socket.on('connect_error', (err) => {
  if (err.message === 'AUTH_REQUIRED' || err.message === 'AUTH_FAILED') {
    console.error('[socket] Authentication failed:', err.message)
    localStorage.removeItem('werewolf_token')
    localStorage.removeItem('werewolf_user')
    window.location.href = '/login'
  }
})

socket.on('error', (err) => {
  console.error('[socket] Server error:', err?.message || err)
})

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

function authenticate(userId, username) {
  return new Promise((resolve) => {
    if (socket.connected) {
      resolve({ socketId: socket.id })
      return
    }
    socket.once('authenticated', (data) => {
      console.log('[socket] authenticated:', data)
      resolve(data)
    })
  })
}

export { authenticate, socket }
export default socket
