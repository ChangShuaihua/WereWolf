<template>
  <div class="room-page">
    <div class="room-main">
      <div class="room-header">
        <button class="btn btn-sm" @click="handleLeave">← 返回大厅</button>
        <div class="room-title">
          <h2>房间 {{ roomStore.roomCode }}</h2>
          <button class="btn btn-sm" @click="copyCode">复制房间号</button>
        </div>
      </div>

      <PlayerList
        :players="roomStore.players"
        :hostId="roomStore.hostId"
        :myId="socket.id"
        :showReady="true"
      />

      <div class="room-actions">
        <button
          class="btn"
          :class="isReady ? 'btn-ready' : 'btn-secondary'"
          @click="roomStore.toggleReady()"
        >
          {{ isReady ? '✅ 已准备' : '准备' }}
        </button>
        <button
          v-if="roomStore.isHost()"
          class="btn btn-primary"
          :disabled="!roomStore.allReady()"
          @click="roomStore.startGame()"
        >
          {{ roomStore.players.length >= 4 ? '开始游戏' : `至少需要4人 (当前${roomStore.players.length})` }}
        </button>
      </div>
    </div>

    <div class="room-sidebar">
      <ChatBox :messages="roomStore.chat" @send="roomStore.sendChat" />
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useGameStore } from '../stores/game'
import socket from '../socket'
import api from '../api'
import PlayerList from '../components/PlayerList.vue'
import ChatBox from '../components/ChatBox.vue'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const loading = ref(true)

const isReady = computed(() => {
  const me = roomStore.players.find(p => p.socketId === socket.id)
  return me?.isReady || false
})

function _onGameStarted() { router.push(`/game/${roomStore.roomCode}`) }

async function fetchRoomInfo() {
  const code = route.params.code
  if (!code) {
    router.push('/lobby')
    return
  }
  
  try {
    const { data } = await api.get(`/room/${code}`)
    roomStore.roomCode = data.code
    roomStore.hostId = data.hostId
    roomStore.players = data.players
    roomStore.chat = data.chat || []
  } catch (e) {
    console.error('Failed to fetch room info:', e)
    router.push('/lobby')
    return
  }
  
  loading.value = false
}

onMounted(async () => {
  if (!socket.connected) socket.connect()
  
  await fetchRoomInfo()
  
  roomStore.joinRoom(roomStore.roomCode)
  
  roomStore.bindEvents()
  gameStore.bindEvents()
  socket.on('game_started', _onGameStarted)
})

onUnmounted(() => {
  socket.off('game_started', _onGameStarted)
})

function handleLeave() {
  roomStore.leaveRoom()
  router.push('/lobby')
}

function copyCode() {
  navigator.clipboard.writeText(roomStore.roomCode).catch(() => {})
  alert('房间号已复制')
}
</script>
