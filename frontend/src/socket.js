import { io } from 'socket.io-client'

const socket = io('/', {
  autoConnect: false,
  transports: ['websocket', 'polling'],
  path: '/socket.io',
})

export default socket
