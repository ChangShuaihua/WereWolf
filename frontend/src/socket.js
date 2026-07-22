import { io } from 'socket.io-client'

const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  path: '/socket.io',
})

function authenticate(userId, username) {
  return new Promise((resolve) => {
    socket.once('authenticated', (data) => {
      console.log('[socket] authenticated:', data)
      resolve(data)
    })
    socket.emit('authenticate', { userId, username })
  })
}

export { authenticate }
export default socket
