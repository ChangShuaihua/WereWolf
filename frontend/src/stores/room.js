import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import socket from '../socket'
import { useUserStore } from './user'
import { useGameStore } from './game'

export const useRoomStore = defineStore('room', () => {
  const ROOM_CODE_KEY = 'werewolf_room_code'

  const roomCode = ref(localStorage.getItem(ROOM_CODE_KEY) || '')
  const players = ref([])
  const seats = ref([])
  const hostId = ref('')
  const chat = ref([])
  const maxPlayers = ref(6)
  const isInRoom = computed(() => !!roomCode.value)

  const userStore = useUserStore()

  function _onRoomReset() {
    const gameStore = useGameStore()
    gameStore.resetRoleRevealed()
  }

  // ---- event handlers (named so we can off/on) ----
  function _onRoomJoined(data) {
    console.log('[roomStore] room_joined', data)
    roomCode.value = data.code
    localStorage.setItem(ROOM_CODE_KEY, data.code)
    players.value = data.players
    const mp = Number(data.maxPlayers) || 6
    seats.value = data.seats || buildDefaultSeats(mp)
    hostId.value = data.hostId
    maxPlayers.value = mp
    if (data.chat) {
      chat.value = data.chat
    }
  }

  function _onRoomUpdate(data) {
    console.log('[roomStore] room_update', data)
    players.value = [...data.players]
    const mp = Number(data.maxPlayers) || maxPlayers.value
    seats.value = data.seats || buildDefaultSeats(mp)
    hostId.value = data.hostId
    if (data.maxPlayers) maxPlayers.value = mp
  }

  function buildDefaultSeats(count) {
    return Array.from({ length: count }, (_, i) => ({
      seatIndex: i,
      occupied: false,
    }))
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
    socket.off('room_reset', _onRoomReset)

    socket.on('room_joined', _onRoomJoined)
    socket.on('room_update', _onRoomUpdate)
    socket.on('chat_message', _onChatMessage)
    socket.on('room_reset', _onRoomReset)

    console.log('[roomStore] events bound, socket.id=', socket.id, 'connected=', socket.connected)
  }

  function unbindEvents() {
    socket.off('room_joined', _onRoomJoined)
    socket.off('room_update', _onRoomUpdate)
    socket.off('chat_message', _onChatMessage)
    socket.off('room_reset', _onRoomReset)
    // W25: 清理待处理的 addAIPlayer onConnect 监听
    if (_pendingAddAIHandler) {
      socket.off('connect', _pendingAddAIHandler)
      _pendingAddAIHandler = null
    }
  }

  // ---- actions ----
  function createRoom(mode = 6) {
    const playerCount = Number(mode) || 6;
    console.log('[roomStore] createRoom, user=', userStore.user, 'mode=', playerCount)
    maxPlayers.value = playerCount
    seats.value = buildDefaultSeats(playerCount)
    socket.emit('create_room', {
      username: userStore.user?.username,
      userId: userStore.user?.id,
      maxPlayers: playerCount,
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
    localStorage.removeItem(ROOM_CODE_KEY)
    players.value = []
    seats.value = []
    hostId.value = ''
    chat.value = []
    maxPlayers.value = 6
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

  // W25: 命名的 onConnectAddAI 处理器，确保可通过 socket.off 清理，避免重复触发
  function onConnectAddAI(agentId) {
    return function _onConnectAddAI() {
      socket.off('connect', _onConnectAddAI)
      socket.emit('add_ai_player', { roomCode: roomCode.value, agentId })
    }
  }

  function addAIPlayer(agentId = '') {
    console.log('[roomStore] addAIPlayer called, roomCode=', roomCode.value, 'agentId=', agentId, 'connected=', socket.connected)

    if (!socket.connected) {
      console.warn('[roomStore] Socket not connected, connecting...')
      // W25: 先清理可能存在的同名监听，避免重复绑定
      socket.off('connect', _pendingAddAIHandler)
      _pendingAddAIHandler = onConnectAddAI(agentId)
      socket.on('connect', _pendingAddAIHandler)
      socket.connect()
    } else {
      socket.emit('add_ai_player', { roomCode: roomCode.value, agentId })
    }
  }

  // W25: 持有当前待处理的 onConnect 句柄，便于在 unbindEvents 时清理
  let _pendingAddAIHandler = null

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
    return players.value.length >= maxPlayers.value && players.value.every(p => p.isReady)
  }

  // My current seat info
  const mySeat = computed(() => {
    return seats.value.find(s => s.occupied && s.socketId === socket.id)
  })

  const myPlayer = computed(() => {
    return players.value.find(p => p.socketId === socket.id)
  })

  return {
    roomCode, players, seats, hostId, chat, maxPlayers, isInRoom,
    mySeat, myPlayer,
    bindEvents, unbindEvents,
    createRoom, joinRoom, leaveRoom,
    toggleReady, startGame, sendChat, addAIPlayer, removeAIPlayer, isHost, allReady,
    clearRoomCode: () => { roomCode.value = ''; localStorage.removeItem(ROOM_CODE_KEY) },
    getSavedRoomCode: () => localStorage.getItem(ROOM_CODE_KEY),
  }
})
