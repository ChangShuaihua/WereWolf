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
        :isHost="roomStore.isHost()"
        @removeAI="handleRemoveAI"
      />

      <div class="room-actions">
        <button
          class="btn"
          :class="isReady ? 'btn-ready' : 'btn-secondary'"
          @click="roomStore.toggleReady()"
        >
          {{ isReady ? '✅ 已准备' : '准备' }}
        </button>
        <div v-if="roomStore.isHost()" class="add-ai-container">
          <select v-model="selectedAgentId" class="agent-select">
            <option value="">随机智能体</option>
            <option v-for="agent in aiAgents" :key="agent.id" :value="agent.id">
              {{ agent.avatar }} {{ agent.name }}
            </option>
          </select>
          <button
            class="btn btn-secondary"
            :disabled="roomStore.players.length >= 12"
            @click="handleAddAI"
          >
            🤖 添加AI玩家
          </button>
        </div>
        <span v-else class="btn btn-disabled">
          (不是房主)
        </span>

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
      <section class="game-section chat-section">
        <div class="section-header">
          <h3>💬 聊天</h3>
        </div>
        <ChatBox :messages="roomStore.chat" @send="roomStore.sendChat" />
      </section>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useGameStore } from '../stores/game'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import api from '../api'
import PlayerList from '../components/PlayerList.vue'
import ChatBox from '../components/ChatBox.vue'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const loading = ref(true)
const aiAgents = ref([])
const selectedAgentId = ref('')

const isReady = computed(() => {
  const me = roomStore.players.find(p => p.socketId === socket.id)
  return me?.isReady || false
})

const hostDebug = computed(() => {
  return {
    mySocketId: socket.id,
    hostId: roomStore.hostId,
    isHostResult: roomStore.isHost(),
    myUserId: userStore.user?.id,
    hostPlayer: roomStore.players.find(p => (p.socketId || p.id) === roomStore.hostId),
  }
})

function _onGameStarted() { router.push(`/game/${roomStore.roomCode}`) }

function handleAddAI() {
  console.log('[RoomView] handleAddAI clicked')
  console.log('[RoomView] roomStore.players.length:', roomStore.players.length)
  console.log('[RoomView] roomStore.roomCode:', roomStore.roomCode)
  roomStore.addAIPlayer(selectedAgentId.value)
}

function handleRemoveAI(aiSocketId) {
  console.log('[RoomView] handleRemoveAI called, aiSocketId:', aiSocketId)
  roomStore.removeAIPlayer(aiSocketId)
}

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

async function fetchAIAgents() {
  try {
    const response = await fetch('/api/ai-agents');
    aiAgents.value = await response.json();
  } catch (err) {
    console.error('Failed to fetch AI agents:', err);
  }
}

onMounted(async () => {
  if (!socket.connected) socket.connect()
  
  roomStore.bindEvents()
  gameStore.bindEvents()
  socket.on('game_started', _onGameStarted)
  
  if (userStore.user) {
    await authenticate(userStore.user.id, userStore.user.username)
  }
  
  await fetchRoomInfo()
  await fetchAIAgents()
  
  roomStore.joinRoom(roomStore.roomCode)
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
