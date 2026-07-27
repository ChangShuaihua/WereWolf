<template>
  <div class="room-page">
    <div class="room-main">
      <div class="room-header">
        <button class="btn-back" @click="handleLeave">
          <span class="back-icon">←</span>
          <span>返回大厅</span>
        </button>
        
        <div class="room-title-area">
          <h2 class="room-name">房间 <span class="room-code">{{ roomStore.roomCode }}</span></h2>
          <div class="room-meta">
            <span class="room-mode-badge">{{ roomStore.maxPlayers }}人局</span>
            <span class="room-divider">·</span>
            <span class="room-player-count">{{ roomStore.players.length }}/{{ roomStore.maxPlayers }}</span>
            <span class="room-divider">·</span>
            <button class="btn-copy" :class="{ copied: codeCopied }" @click="copyCode">
              <span class="copy-icon">{{ codeCopied ? '✓' : '📋' }}</span>
              <span>{{ codeCopied ? '已复制' : '复制房间号' }}</span>
            </button>
          </div>
        </div>

        <div class="room-header-right">
          <button
            class="btn"
            :class="myIsReady ? 'btn-ready' : 'btn-secondary'"
            @click="roomStore.toggleReady()"
          >
            {{ myIsReady ? '✅ 已准备' : '📌 准备' }}
          </button>
        </div>
      </div>

      <div class="room-content">
        <div class="room-players-panel">
          <div class="panel-title">
            <span class="panel-title-icon">👥</span>
            <span>玩家列表</span>
            <span class="panel-title-badge">{{ roomStore.players.length }}/{{ roomStore.maxPlayers }}</span>
          </div>

          <div class="seat-grid" :class="`seat-grid-${roomStore.maxPlayers}`">
            <div
              v-for="seat in allSeats"
              :key="seat.seatIndex"
              class="seat-card"
              :class="{
                'seat-occupied': seat.occupied,
                'seat-empty': !seat.occupied,
                'seat-me': seat.socketId === socket.id,
                'seat-host': seat.isHost,
                'seat-ready': seat.isReady,
                'seat-ai': seat.isAI,
              }"
            >
              <template v-if="seat.occupied">
                <div class="seat-index">{{ seat.seatIndex + 1 }}</div>
                <div class="seat-avatar" :class="{ 'ai-avatar': seat.isAI }">
                  {{ seat.username?.charAt(0).toUpperCase() || '?' }}
                </div>
                <div class="seat-name">{{ seat.username }}</div>
                <div class="seat-badges">
                  <span v-if="seat.isHost" class="seat-badge badge-host">👑</span>
                  <span v-if="seat.isAI" class="seat-badge badge-ai">🤖</span>
                  <span v-if="seat.isReady" class="seat-badge badge-ready">✅</span>
                </div>
                <button
                  v-if="roomStore.isHost() && seat.isAI"
                  class="seat-remove"
                  @click.stop="handleRemoveAI(seat.socketId)"
                  title="移除AI玩家"
                >
                  ✕
                </button>
              </template>
              <template v-else>
                <div class="seat-index">{{ seat.seatIndex + 1 }}</div>
                <div class="seat-avatar seat-avatar-empty">
                  <span class="seat-empty-icon">+</span>
                </div>
                <div class="seat-name seat-name-empty">等待中</div>
                <div class="seat-badges"></div>
              </template>
            </div>
          </div>
        </div>

        <div class="room-actions-panel" v-if="roomStore.isHost()">
          <div class="panel-title">
            <span class="panel-title-icon">⚙️</span>
            <span>房间管理</span>
          </div>
          <div class="actions-body">
            <div class="add-ai-row">
              <select v-model="selectedAgentId" class="agent-select">
                <option value="">选择AI智能体</option>
                <option v-for="agent in aiAgents" :key="agent.id" :value="agent.id">
                  {{ agent.avatar }} {{ agent.name }}
                </option>
              </select>
              <button
                class="btn btn-ai btn-block"
                :disabled="roomStore.players.length >= roomStore.maxPlayers"
                @click="handleAddAI"
              >
                🤖 添加AI玩家
              </button>
            </div>
            <button
              class="btn btn-primary btn-block btn-start"
              :disabled="!roomStore.allReady()"
              @click="roomStore.startGame()"
            >
              <template v-if="roomStore.players.length >= roomStore.maxPlayers && roomStore.allReady()">
                🎮 开始游戏
              </template>
              <template v-else>
                等待其他玩家准备...
              </template>
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="room-chat-panel">
      <div class="panel-title">
        <span class="panel-title-icon">💬</span>
        <span>房间聊天</span>
      </div>
      <ChatBox :messages="roomStore.chat" @send="roomStore.sendChat" />
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
import ChatBox from '../components/ChatBox.vue'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const loading = ref(true)
const aiAgents = ref([])
const selectedAgentId = ref('')
const codeCopied = ref(false)

const myIsReady = computed(() => {
  const me = roomStore.players.find(p => p.socketId === socket.id)
  return me?.isReady || false
})

const allSeats = computed(() => {
  const total = roomStore.maxPlayers
  const result = []
  for (let i = 0; i < total; i++) {
    const seat = roomStore.seats.find(s => s.seatIndex === i)
    if (seat && seat.occupied) {
      result.push(seat)
    } else {
      result.push({ seatIndex: i, occupied: false })
    }
  }
  return result
})

function _onGameStarted() { router.push(`/game/${roomStore.roomCode}`) }

function handleAddAI() {
  roomStore.addAIPlayer(selectedAgentId.value)
}

function handleRemoveAI(aiSocketId) {
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
    roomStore.seats = data.seats || []
    roomStore.chat = data.chat || []
    roomStore.maxPlayers = Number(data.maxPlayers) || 6
  } catch (e) {
    console.error('Failed to fetch room info:', e)
    router.push('/lobby')
    return
  }

  loading.value = false
}

async function fetchAIAgents() {
  try {
    const { data } = await api.get('/ai-agents');
    aiAgents.value = data;
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
  codeCopied.value = true
  setTimeout(() => { codeCopied.value = false }, 2000)
}
</script>

<style scoped>
.room-page {
  min-height: calc(100vh - 76px);
  background: var(--bg-primary);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px 24px;
  position: relative;
  align-items: stretch;
}

.room-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(ellipse at 15% 0%, rgba(155, 109, 255, 0.08) 0%, transparent 45%),
    radial-gradient(ellipse at 85% 100%, rgba(79, 140, 255, 0.06) 0%, transparent 45%);
  pointer-events: none;
  z-index: 0;
}

.room-main {
  display: flex;
  flex-direction: column;
  gap: 16px;
  position: relative;
  z-index: 1;
  min-width: 0;
  height: 100%;
}

.room-header {
  display: flex;
  align-items: center;
  gap: 20px;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-thin);
  border-radius: var(--radius-xl);
  padding: 14px 20px;
}

.btn-back {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.03);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 0.88rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
  flex-shrink: 0;
}

.btn-back:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.15);
  color: var(--text-primary);
}

.btn-back .back-icon {
  font-size: 0.82rem;
  transition: transform 0.2s;
}

.btn-back:hover .back-icon {
  transform: translateX(-2px);
}

.room-title-area {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 4px;
  letter-spacing: 0.02em;
}

.room-code {
  font-family: var(--font-mono);
  background: rgba(155, 109, 255, 0.12);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  color: var(--ai-light);
  font-size: 0.95rem;
}

.room-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.82rem;
}

.room-mode-badge {
  padding: 2px 10px;
  background: rgba(155, 109, 255, 0.1);
  color: var(--ai-light);
  border-radius: var(--radius-full);
  font-weight: 600;
}

.room-divider {
  color: var(--text-tertiary);
  opacity: 0.5;
}

.room-player-count {
  color: var(--text-secondary);
  font-family: var(--font-mono);
  font-weight: 600;
}

.btn-copy {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.03);
  border: var(--border-thin);
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
  font-size: 0.78rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.btn-copy:hover {
  background: rgba(155, 109, 255, 0.1);
  border-color: rgba(155, 109, 255, 0.25);
  color: var(--ai-light);
}

.btn-copy.copied {
  background: rgba(54, 211, 153, 0.1);
  border-color: rgba(54, 211, 153, 0.25);
  color: var(--status-success);
}

.btn-copy .copy-icon {
  font-size: 0.85rem;
}

.room-header-right {
  flex-shrink: 0;
}

.room-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
}

.room-players-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-thin);
  border-radius: var(--radius-xl);
  padding: 20px;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.room-actions-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-thin);
  border-radius: var(--radius-xl);
  padding: 20px;
  flex-shrink: 0;
}

.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.98rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.panel-title-icon {
  font-size: 1.05rem;
}

.panel-title-badge {
  margin-left: auto;
  padding: 2px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-weight: 600;
}

.seat-grid {
  display: grid;
  gap: 14px;
  flex: 1;
  align-content: start;
}

.seat-grid-6 {
  grid-template-columns: repeat(3, 1fr);
}

.seat-grid-8 {
  grid-template-columns: repeat(4, 1fr);
}

.seat-grid-12 {
  grid-template-columns: repeat(4, 1fr);
}

.seat-card {
  position: relative;
  background: rgba(255, 255, 255, 0.015);
  border: var(--border-thin);
  border-radius: var(--radius-lg);
  padding: 16px 12px 14px;
  text-align: center;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  min-height: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.seat-card:hover {
  background: rgba(255, 255, 255, 0.035);
  border-color: rgba(255, 255, 255, 0.1);
}

.seat-occupied {
  background: rgba(255, 255, 255, 0.035);
  border-color: var(--border-thin);
}

.seat-empty {
  border-style: dashed;
  opacity: 0.55;
}

.seat-empty:hover {
  opacity: 0.75;
}

.seat-me {
  border-color: var(--ai-primary);
  background: rgba(155, 109, 255, 0.07);
  box-shadow: 0 0 20px rgba(155, 109, 255, 0.1);
}

.seat-host {
  border-color: rgba(245, 185, 66, 0.45);
}

.seat-ready {
  border-color: rgba(54, 211, 153, 0.4);
}

.seat-ai {
  border-color: rgba(155, 109, 255, 0.4);
}

.seat-index {
  position: absolute;
  top: 8px;
  left: 10px;
  font-size: 0.68rem;
  color: var(--text-tertiary);
  font-family: var(--font-mono);
  font-weight: 700;
  opacity: 0.55;
}

.seat-avatar {
  width: 48px;
  height: 48px;
  margin: 4px auto 2px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  border: 2px solid rgba(255, 255, 255, 0.06);
}

.seat-avatar.ai-avatar {
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 14px var(--ai-glow);
}

.seat-avatar-empty {
  background: rgba(255, 255, 255, 0.02);
  border: 2px dashed rgba(255, 255, 255, 0.08);
  color: var(--text-tertiary);
}

.seat-empty-icon {
  font-size: 1.3rem;
  font-weight: 300;
}

.seat-name {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.seat-name-empty {
  color: var(--text-tertiary);
  font-style: italic;
  font-weight: 400;
  font-size: 0.8rem;
}

.seat-badges {
  display: flex;
  justify-content: center;
  gap: 5px;
  min-height: 18px;
}

.seat-badge {
  font-size: 0.82rem;
}

.seat-remove {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 20px;
  height: 20px;
  background: rgba(229, 57, 53, 0.65);
  border: none;
  border-radius: 50%;
  color: white;
  cursor: pointer;
  font-size: 0.68rem;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  opacity: 0;
}

.seat-card:hover .seat-remove {
  opacity: 1;
}

.seat-remove:hover {
  background: var(--status-error);
  transform: scale(1.12);
}

.actions-body {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.add-ai-row {
  display: flex;
  gap: 10px;
}

.agent-select {
  flex: 1;
  height: 42px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.03);
  border: var(--border-thin);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.88rem;
  outline: none;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.agent-select:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.agent-select:focus {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 3px var(--ai-glow);
}

.agent-select option {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.btn-start {
  font-size: 1rem !important;
  padding: 14px 20px !important;
}

.room-chat-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-thin);
  border-radius: var(--radius-xl);
  padding: 18px;
  display: flex;
  flex-direction: column;
  position: relative;
  z-index: 1;
  height: 100%;
  min-height: 0;
}

.room-chat-panel > :deep(.chat-box) {
  flex: 1;
  min-height: 0;
}

@media (max-width: 900px) {
  .room-page {
    grid-template-columns: 1fr;
  }

  .room-header {
    flex-wrap: wrap;
    gap: 12px;
  }

  .room-title-area {
    order: 3;
    width: 100%;
  }

  .seat-grid-6,
  .seat-grid-8,
  .seat-grid-12 {
    grid-template-columns: repeat(3, 1fr);
  }

  .add-ai-row {
    flex-direction: column;
  }

  .room-chat-panel {
    min-height: 350px;
  }
}
</style>
