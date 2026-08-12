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
          </div>
        </div>

        <div class="room-header-right">
          <button class="btn btn-rule" @click="showRulePanel = true" type="button">
            📖 游戏规则
          </button>
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

    <!-- 游戏规则问答弹窗卡片 -->
    <div v-if="showRulePanel" class="rule-modal-mask" @click.self="showRulePanel = false">
      <div class="rule-modal" @click.stop>
        <div class="rule-modal-header">
          <div class="rule-modal-title">
            <span class="rule-icon">📖</span>
            <span>游戏规则问答</span>
          </div>
          <button class="rule-close-btn" @click="showRulePanel = false" type="button">✕</button>
        </div>

        <div class="rule-modal-body">
          <div v-if="ruleQAList.length === 0" class="rule-empty">
            <div class="rule-empty-icon">🎯</div>
            <p>欢迎使用规则助手！</p>
            <p class="rule-empty-hint">可以选择下方快捷问题，或输入你想了解的规则</p>
          </div>

          <div v-else class="rule-qa-list" ref="ruleQAListRef">
            <div v-for="(item, i) in ruleQAList" :key="i" class="rule-qa-item" :class="item.loading ? 'loading' : ''">
              <div class="rule-qa-q">
                <span class="qa-tag q-tag">Q</span>
                <span class="qa-text">{{ item.question }}</span>
              </div>
              <div v-if="item.answer" class="rule-qa-a">
                <span class="qa-tag a-tag">A</span>
                <div class="qa-text" v-html="renderMarkdown(item.answer)"></div>
              </div>
              <div v-else class="rule-qa-a rule-qa-loading">
                <span class="qa-tag a-tag">A</span>
                <span class="qa-text">思考中<span class="dots">...</span></span>
              </div>
            </div>
          </div>
        </div>

        <div class="rule-quick-row">
          <button 
            v-for="q in quickRuleQuestions" 
            :key="q" 
            class="rule-quick-btn" 
            @click="askRuleQuestion(q)"
            type="button"
            :disabled="ruleLoading"
          >{{ q }}</button>
        </div>

        <div class="rule-input-row">
          <input
            v-model="ruleInput"
            class="rule-input"
            type="text"
            placeholder="输入你的规则问题，例如：女巫怎么玩？"
            @keyup.enter="submitRuleQuestion"
            :disabled="ruleLoading"
          />
          <button 
            class="btn btn-primary rule-submit-btn" 
            @click="submitRuleQuestion"
            type="button"
            :disabled="ruleLoading || !ruleInput.trim()"
          >
            {{ ruleLoading ? '思考中...' : '提问' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useGameStore } from '../stores/game'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import api from '../api'
import ChatBox from '../components/ChatBox.vue'
import { renderMarkdown } from '../utils/markdown'

const router = useRouter()
const route = useRoute()
const roomStore = useRoomStore()
const gameStore = useGameStore()
const userStore = useUserStore()
const loading = ref(true)
const aiAgents = ref([])
const selectedAgentId = ref('')

// 规则问答面板
const showRulePanel = ref(false)
const ruleInput = ref('')
const ruleLoading = ref(false)
const ruleQAList = ref([])
const ruleQAListRef = ref(null)

const quickRuleQuestions = [
  '女巫怎么玩',
  '守卫能连续守同一人吗',
  '猎人被毒杀能开枪吗',
  '预言家能验自己吗',
  '同守同救会怎样',
]

function askRuleQuestion(q) {
  ruleInput.value = q
  submitRuleQuestion()
}

function submitRuleQuestion() {
  const q = ruleInput.value.trim()
  if (!q || ruleLoading.value) return
  ruleLoading.value = true
  const qaItem = { question: q, answer: '', loading: true }
  ruleQAList.value.push(qaItem)
  ruleInput.value = ''
  nextTick(() => {
    if (ruleQAListRef.value) {
      ruleQAListRef.value.scrollTop = ruleQAListRef.value.scrollHeight
    }
  })
  socket.emit('rule_qa', { question: q })
}

function _onRuleAnswer(data) {
  ruleLoading.value = false
  const last = ruleQAList.value[ruleQAList.value.length - 1]
  if (last && last.question === data.question && last.loading) {
    last.answer = data.answer
    last.loading = false
  } else {
    ruleQAList.value.push({ question: data.question, answer: data.answer, loading: false })
  }
  nextTick(() => {
    if (ruleQAListRef.value) {
      ruleQAListRef.value.scrollTop = ruleQAListRef.value.scrollHeight
    }
  })
}

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
    localStorage.setItem('werewolf_room_code', data.code)
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
  socket.on('rule_qa_answer', _onRuleAnswer)

  if (userStore.user) {
    await authenticate() // W26: 统一无参签名
  }

  await fetchRoomInfo()
  await fetchAIAgents()

  // FIX: set up listener BEFORE emitting join_room
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      socket.off('room_joined', onJoined)
      resolve()
    }, 5000)
    function onJoined(data) {
      clearTimeout(timeout)
      socket.off('room_joined', onJoined)
      resolve()
    }
    socket.once('room_joined', onJoined)
    roomStore.joinRoom(roomStore.roomCode)
  })
})

onUnmounted(() => {
  socket.off('game_started', _onGameStarted)
  socket.off('rule_qa_answer', _onRuleAnswer)
})

function handleLeave() {
  roomStore.leaveRoom()
  router.push('/lobby')
}
</script>

<style scoped>
.room-page {
  height: 100%;
  background: var(--bg-primary);
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding: 20px 24px;
  position: relative;
  align-items: stretch;
  overflow: hidden;
}

.room-page::before {
  content: '';
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(ellipse at 15% 0%, rgba(20, 184, 166, 0.1) 0%, transparent 45%),
    radial-gradient(ellipse at 85% 100%, rgba(59, 130, 246, 0.08) 0%, transparent 45%);
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
  max-height: 100%;
  overflow: hidden;
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
  background: var(--bg-secondary);
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
  background: var(--bg-tertiary);
  border-color: var(--text-tertiary);
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
  background: rgba(20, 184, 166, 0.1);
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  color: var(--ai-secondary);
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
  background: rgba(20, 184, 166, 0.1);
  color: var(--ai-secondary);
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

.room-header-right {
  flex-shrink: 0;
}

.room-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
  flex: 1;
  min-height: 0;
  max-height: 100%;
  overflow: hidden;
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
  overflow: hidden;
}

.room-players-panel .panel-title {
  flex-shrink: 0;
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
  background: rgba(0, 0, 0, 0.05);
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
  overflow-y: auto;
  min-height: 0;
  padding-right: 4px;
}

.seat-grid::-webkit-scrollbar {
  width: 6px;
}

.seat-grid::-webkit-scrollbar-track {
  background: transparent;
}

.seat-grid::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.seat-grid::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
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
  background: var(--bg-card);
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
  background: var(--bg-hover);
  border-color: var(--text-tertiary);
}

.seat-occupied {
  background: var(--bg-secondary);
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
  background: rgba(20, 184, 166, 0.08);
  box-shadow: 0 0 20px rgba(20, 184, 166, 0.1);
}

.seat-host {
  border-color: rgba(245, 185, 66, 0.45);
}

.seat-ready {
  border-color: rgba(54, 211, 153, 0.4);
}

.seat-ai {
  border-color: rgba(20, 184, 166, 0.4);
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
  background: rgba(0, 0, 0, 0.05);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--text-primary);
  border: 2px solid rgba(0, 0, 0, 0.08);
}

.seat-avatar.ai-avatar {
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  color: white;
  border-color: transparent;
  box-shadow: 0 4px 14px var(--ai-glow);
}

.seat-avatar-empty {
  background: var(--bg-tertiary);
  border: 2px dashed var(--text-tertiary);
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
  background: var(--bg-secondary);
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
  border-color: var(--ai-primary);
  background: var(--bg-tertiary);
}

.agent-select:focus {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 3px var(--ai-glow);
}

.agent-select option {
  background: var(--bg-card);
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
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
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

/* ===== 游戏规则按钮 ===== */
.btn-rule {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
  font-family: var(--font-sans);
}

.btn-rule:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
  color: #bbf7d0;
}

/* ===== 规则问答弹窗 ===== */
.rule-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.rule-modal {
  width: 100%;
  max-width: 560px;
  max-height: 82vh;
  background: var(--bg-card);
  border: var(--border-thin);
  border-radius: var(--radius-2xl);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  animation: ruleFadeIn 0.25s ease;
}

@keyframes ruleFadeIn {
  from { opacity: 0; transform: translateY(-16px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

.rule-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 18px 22px;
  background: linear-gradient(135deg, rgba(34, 197, 94, 0.12), rgba(20, 184, 166, 0.08));
  border-bottom: var(--border-thin);
}

.rule-modal-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--text-primary);
}

.rule-icon {
  font-size: 1.2rem;
}

.rule-close-btn {
  width: 32px;
  height: 32px;
  border-radius: var(--radius-md);
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.rule-close-btn:hover {
  background: var(--bg-tertiary);
  color: var(--status-error);
}

.rule-modal-body {
  flex: 1;
  min-height: 260px;
  max-height: 420px;
  overflow-y: auto;
  padding: 20px 22px;
}

.rule-modal-body::-webkit-scrollbar {
  width: 6px;
}

.rule-modal-body::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.rule-empty {
  height: 100%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  color: var(--text-secondary);
}

.rule-empty-icon {
  font-size: 2.8rem;
  margin-bottom: 14px;
}

.rule-empty p {
  margin: 4px 0;
  font-size: 0.95rem;
}

.rule-empty-hint {
  color: var(--text-tertiary);
  font-size: 0.85rem !important;
}

.rule-qa-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rule-qa-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.rule-qa-q,
.rule-qa-a {
  display: flex;
  gap: 10px;
  align-items: flex-start;
}

.qa-tag {
  flex-shrink: 0;
  width: 26px;
  height: 26px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 700;
  font-family: var(--font-mono);
}

.q-tag {
  background: rgba(59, 130, 246, 0.15);
  color: #93c5fd;
}

.a-tag {
  background: rgba(34, 197, 94, 0.15);
  color: #86efac;
}

.qa-text {
  flex: 1;
  font-size: 0.92rem;
  line-height: 1.7;
  color: var(--text-primary);
  padding-top: 3px;
  word-break: break-word;
}

/* Markdown 渲染样式 */
.qa-text :deep(h2),
.qa-text :deep(h3),
.qa-text :deep(h4) {
  margin: 10px 0 6px;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--ai-secondary);
  line-height: 1.4;
}

.qa-text :deep(h2) { font-size: 1rem; }
.qa-text :deep(h3) { font-size: 0.95rem; }
.qa-text :deep(h4) { font-size: 0.9rem; }

.qa-text :deep(strong) {
  color: var(--ai-primary);
  font-weight: 700;
}

.qa-text :deep(em) {
  color: var(--text-secondary);
  font-style: italic;
}

.qa-text :deep(ul) {
  margin: 6px 0;
  padding-left: 18px;
  list-style: disc;
}

.qa-text :deep(li) {
  margin: 2px 0;
  line-height: 1.6;
}

.qa-text :deep(p) {
  margin: 4px 0;
  line-height: 1.7;
}

.qa-text :deep(code) {
  padding: 1px 6px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  font-size: 0.85em;
  color: var(--ai-secondary);
}

.rule-qa-loading .qa-text {
  color: var(--text-tertiary);
}

.dots {
  display: inline-block;
  animation: dotsBlink 1.2s steps(4) infinite;
}

@keyframes dotsBlink {
  0% { opacity: 0.2; }
  50% { opacity: 1; }
  100% { opacity: 0.2; }
}

.rule-quick-row {
  display: flex;
  gap: 8px;
  padding: 12px 22px;
  overflow-x: auto;
  border-top: var(--border-thin);
  background: var(--bg-secondary);
}

.rule-quick-btn {
  flex-shrink: 0;
  padding: 7px 14px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-color);
  border-radius: 999px;
  font-size: 0.8rem;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
  white-space: nowrap;
  font-weight: 500;
}

.rule-quick-btn:hover:not(:disabled) {
  background: rgba(34, 197, 94, 0.15);
  border-color: var(--ai-secondary);
  color: var(--ai-secondary);
}

.rule-quick-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.rule-input-row {
  display: flex;
  gap: 10px;
  padding: 14px 22px 20px;
  border-top: var(--border-thin);
  background: var(--glass-bg);
}

.rule-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.92rem;
  font-family: var(--font-sans);
  outline: none;
  transition: all 0.2s;
}

.rule-input::placeholder {
  color: var(--text-tertiary);
}

.rule-input:focus {
  border-color: var(--ai-secondary);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.rule-input:disabled {
  opacity: 0.6;
}

.rule-submit-btn {
  padding: 10px 20px !important;
  flex-shrink: 0;
  white-space: nowrap;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: var(--radius-md);
  color: #fff;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.rule-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
}

.rule-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
