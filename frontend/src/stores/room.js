import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import socket from '../socket'
import { useUserStore } from './user'

export const useRoomStore = defineStore('room', () => {
  const roomCode = ref('')
  const players = ref([])
  const hostId = ref('')
  const chat = ref([])
  const isInRoom = computed(() => !!roomCode.value)

  const userStore = useUserStore()

  // ---- event handlers (named so we can off/on) ----
  function _onRoomJoined(data) {
    console.log('[roomStore] room_joined', data)
    console.log('[roomStore] players from room_joined:', data.players?.map(p => ({ username: p.username, socketId: p.socketId, userId: p.userId })))
    roomCode.value = data.code
    players.value = data.players
    hostId.value = data.hostId
    console.log('[roomStore] isHost check:', { mySocketId: socket.id, hostId: data.hostId, myUserId: userStore.user?.id })
  }

  

  function _onRoomUpdate(data) {
    console.log('[roomStore] room_update', data)
    console.log('[roomStore] players from room_update:', data.players?.map(p => ({ username: p.username, socketId: p.socketId, userId: p.userId })))
    players.value = [...data.players]
    hostId.value = data.hostId
  }

  function _onChatMessage(msg) {
    console.log('[roomStore] chat_message', msg)
    chat.value.push(msg)
  }

  // ---- bind / unbind ----
  function bindEvents() {
    socket.off('room_joined', _onRoomJoined)
    socket.off('room_update', _onRoomUpdate)
    socket.off('chat_message', _onChatMessage)

    socket.on('room_joined', _onRoomJoined)
    socket.on('room_update', _onRoomUpdate)
    socket.on('chat_message', _onChatMessage)

    console.log('[roomStore] events bound, socket.id=', socket.id, 'connected=', socket.connected)
  }

  function unbindEvents() {
    socket.off('room_joined', _onRoomJoined)
    socket.off('room_update', _onRoomUpdate)
    socket.off('chat_message', _onChatMessage)
  }

  // ---- actions ----
  function createRoom() {
    console.log('[roomStore] createRoom, user=', userStore.user)
    console.log('[roomStore] userId:', userStore.user?.id, 'typeof:', typeof userStore.user?.id)
    socket.emit('create_room', {
      username: userStore.user?.username,
      userId: userStore.user?.id,
    })
  }

  function joinRoom(code) {
    console.log('[roomStore] joinRoom', code)
    socket.emit('join_room', {
      roomCode: code,
      username: userStore.user?.username,
      userId: userStore.user?.id,
    })
  }

  function leaveRoom() {
    socket.emit('leave_room', { roomCode: roomCode.value })
    roomCode.value = ''
    players.value = []
    hostId.value = ''
    chat.value = []
  }

  function toggleReady() {
    socket.emit('player_ready', { roomCode: roomCode.value })
  }

  function startGame() {
    socket.emit('start_game', { roomCode: roomCode.value })
  }

  function sendChat(message) {
    console.log('[roomStore] sendChat', message, 'roomCode=', roomCode.value)
    socket.emit('chat', { message, roomCode: roomCode.value })
  }

  function addAIPlayer(agentId = '') {
    console.log('[roomStore] addAIPlayer called')
    console.log('[roomStore] roomCode.value:', roomCode.value)
    console.log('[roomStore] socket.connected:', socket.connected)
    console.log('[roomStore] socket.id:', socket.id)
    console.log('[roomStore] agentId:', agentId)
    
    if (!socket.connected) {
      console.warn('[roomStore] Socket not connected, connecting...')
      socket.connect()
      socket.once('connect', () => {
        console.log('[roomStore] Socket connected, now sending add_ai_player')
        socket.emit('add_ai_player', { roomCode: roomCode.value, agentId })
      })
    } else {
      console.log('[roomStore] Sending add_ai_player event with roomCode:', roomCode.value)
      socket.emit('add_ai_player', { roomCode: roomCode.value, agentId })
      console.log('[roomStore] add_ai_player event sent')
    }
  }

  function removeAIPlayer(aiSocketId) {
    console.log('[roomStore] removeAIPlayer called, aiSocketId:', aiSocketId)
    if (socket.connected) {
      socket.emit('remove_ai_player', { roomCode: roomCode.value, aiSocketId })
    }
  }

  function isHost() {
    if (socket.id === hostId.value) return true
    const hostPlayer = players.value.find(p => (p.socketId || p.id) === hostId.value)
    return hostPlayer?.userId === userStore.user?.id
  }

  function allReady() {
    return players.value.length >= 4 && players.value.every(p => p.isReady)
  }

  return {
    roomCode, players, hostId, chat, isInRoom,
    bindEvents, unbindEvents,
    createRoom, joinRoom, leaveRoom,
    toggleReady, startGame, sendChat, addAIPlayer, removeAIPlayer, isHost, allReady,
  }
})
