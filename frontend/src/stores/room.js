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
    roomCode.value = data.code
    players.value = data.players
    hostId.value = data.hostId
  }

  

  function _onRoomUpdate(data) {
    console.log('[roomStore] room_update', data)
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

  function isHost() {
    return socket.id === hostId.value
  }

  function allReady() {
    return players.value.length >= 4 && players.value.every(p => p.isReady)
  }

  return {
    roomCode, players, hostId, chat, isInRoom,
    bindEvents, unbindEvents,
    createRoom, joinRoom, leaveRoom,
    toggleReady, startGame, sendChat, isHost, allReady,
  }
})
