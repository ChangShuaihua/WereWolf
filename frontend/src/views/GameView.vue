<template>
  <div class="game-page">
    <!-- Loading overlay -->
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner"></div>
      <p>正在连接到游戏...</p>
    </div>

    <template v-else>
    <!-- Role Reveal Overlay -->
    <RoleReveal v-if="showRoleReveal" :role="gameStore.myRole" :roleName="gameStore.myRoleName" @close="showRoleReveal = false" />

    <!-- Top Bar -->
    <header class="game-header">
      <div class="game-header-left">
        <div class="phase-indicator" :class="phaseClass">
          <span class="phase-icon">{{ phaseIcon }}</span>
          <span class="phase-text">{{ phaseLabel }}</span>
          <span v-if="gameStore.nightCount && gameStore.isNight" class="night-number">第{{ gameStore.nightCount }}夜</span>
        </div>
      </div>

      <div class="game-header-center">
        <div
          class="my-role"
          v-if="gameStore.myRole"
          @click="showRoleReveal = true"
          title="点击查看角色详情"
        >
          <span class="role-emoji">{{ roleIcon }}</span>
          <span class="role-name">{{ gameStore.myRoleName }}</span>
        </div>
        <Countdown v-if="gameStore.isNight || gameStore.phase === 'LAST_WILL' || gameStore.phase === 'DISCUSSION' || gameStore.phase === 'DAY'" :timeout="gameStore.timeout" :phase="gameStore.phase" />
      </div>

      <div class="game-header-right">
        <button class="btn-game-rule" @click="showRulePanel = true" type="button" title="游戏规则问答">
          📖 规则
        </button>
        <div class="game-message" v-if="gameStore.message">{{ gameStore.message }}</div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="game-main">
      <!-- Left Panel: Player List & Action Panels -->
      <div class="game-left-panel">
        <!-- Player Grid -->
        <section class="game-section player-section">
            <div class="section-header">
              <div class="section-title">
                <span class="section-icon">👥</span>
                <span>玩家列表</span>
              </div>
              <span class="section-badge">{{ aliveCount }}/{{ roomStore.maxPlayers }} 存活</span>
            </div>
            <div class="player-grid-wrapper">
              <PlayerList
                :players="gameStore.players"
                :myId="mySocketId"
                :showRoles="gameStore.isEnd"
                :roles="gameOverRoles"
                :maxPlayers="roomStore.maxPlayers"
                :candidates="gameStore.candidates"
                :currentSpeaker="gameStore.currentSpeaker"
              />
            </div>
          </section>

        <!-- Action Panels -->
        <section class="game-section action-section">
          <NightPanel
            v-if="gameStore.isNight && gameStore.myPlayer?.isAlive"
            :prompt="gameStore.nightActionPrompt"
            :seerResult="gameStore.seerResult"
            :currentNightRole="gameStore.currentNightRole"
            :werewolf-vote-state="gameStore.werewolfVoteState"
            @action="gameStore.submitNightAction"
          />

          <HunterPanel
            v-if="gameStore.hunterPrompt"
            :prompt="gameStore.hunterPrompt"
            @shoot="gameStore.submitHunterShoot"
          />

          <DayPanel
            v-if="gameStore.isDay"
            :message="gameStore.message"
            :isAlive="gameStore.myPlayer?.isAlive"
            :currentSpeaker="gameStore.currentSpeaker"
            :speakerName="gameStore.speakerName"
            :mySocketId="mySocketId"
            @skip="gameStore.skipSpeaking()"
            @next="gameStore.nextSpeaker()"
            @skipDay="gameStore.skipDay()"
          />

          <VotePanel
            v-if="gameStore.isVote && gameStore.myPlayer?.isAlive"
            :candidates="gameStore.candidates"
            :votedCount="gameStore.votedCount"
            :totalVoters="gameStore.totalVoters"
            :existingVote="gameStore.myVote"
            @vote="gameStore.submitVote"
          />
        </section>
      </div>

      <!-- Right Panel: Chat -->
      <aside class="game-right-panel">
        <section class="game-section chat-section">
          <div class="section-header">
            <div class="section-title">
              <span class="section-icon">💬</span>
              <span>聊天</span>
            </div>
          </div>
          <ChatBox 
            :messages="roomStore.chat" 
            :phase="gameStore.phase"
            :current-speaker="gameStore.currentSpeaker"
            :is-alive="gameStore.myPlayer?.isAlive ?? true"
            @send="handleChat" 
          />
        </section>
      </aside>
    </div>

    <!-- Game Over -->
    <GameResult
      v-if="gameStore.isEnd"
      :result="gameStore.gameOver"
      :replay-game-id="gameStore.replayGameId"
      @back="goToLobby"
      @returnRoom="returnToRoom"
      @viewReplay="viewReplay"
    />

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
            class="rule-submit-btn" 
            @click="submitRuleQuestion"
            type="button"
            :disabled="ruleLoading || !ruleInput.trim()"
          >
            {{ ruleLoading ? '思考中...' : '提问' }}
          </button>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useRoomStore } from '../stores/room'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import PlayerList from '../components/PlayerList.vue'
import ChatBox from '../components/ChatBox.vue'
import RoleReveal from '../components/RoleReveal.vue'
import Countdown from '../components/Countdown.vue'
import NightPanel from '../components/NightPanel.vue'
import DayPanel from '../components/DayPanel.vue'
import VotePanel from '../components/VotePanel.vue'
import GameResult from '../components/GameResult.vue'
import HunterPanel from '../components/HunterPanel.vue'
import { renderMarkdown } from '../utils/markdown'

const router = useRouter()
const route = useRoute()
const gameStore = useGameStore()
const roomStore = useRoomStore()
const userStore = useUserStore()

const showRoleReveal = ref(false)
const loading = ref(true)

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

// C12: safe access to socket.id (may be undefined during reconnect)
const mySocketId = computed(() => socket.id || '')

const phaseLabel = computed(() => {
  const labels = { WAITING: '等待中', NIGHT: '夜晚', LAST_WILL: '死亡遗言', DISCUSSION: '自由讨论', DAY: '轮流发言', VOTE: '投票', END: '游戏结束' }
  return labels[gameStore.phase] || gameStore.phase
})

const phaseIcon = computed(() => {
  const icons = { WAITING: '⏳', NIGHT: '🌙', LAST_WILL: '💀', DISCUSSION: '💬', DAY: '🎤', VOTE: '🗳️', END: '🏆' }
  return icons[gameStore.phase] || '❓'
})

const phaseClass = computed(() => gameStore.phase.toLowerCase())

const roleIcons = {
  werewolf: '🐺',
  villager: '👨‍🌾',
  seer: '🔮',
  witch: '🧪',
  hunter: '🏹',
  guard: '🛡️',
}

const roleIcon = computed(() => roleIcons[gameStore.myRole] || '❓')

const aliveCount = computed(() => gameStore.players.filter(p => p.isAlive).length)

function viewReplay(gameId) {
  router.push({
    name: 'Replay',
    params: { id: gameId },
    query: { room: route.params.code },
  })
}

const gameOverRoles = computed(() => {
  if (!gameStore.gameOver) return {}
  const map = {}
  gameStore.gameOver.players.forEach(p => { map[p.id] = p.role })
  return map
})

async function reconnectToRoom() {
  const code = route.params.code
  if (!code) {
    router.push('/lobby')
    return
  }

  if (!socket.connected) socket.connect()

  roomStore.bindEvents()
  gameStore.bindEvents()

  if (userStore.user) {
    await authenticate() // W26: 统一无参签名
  }

  // Wait for socket connection
  await new Promise((resolve) => {
    if (socket.connected) {
      resolve()
    } else {
      socket.once('connect', resolve)
      setTimeout(resolve, 3000)
    }
  })

  // FIX: set up listener BEFORE emitting join_room to avoid race condition
  // where the backend response arrives before the listener is registered.
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

    // Now safe to emit — listener is registered
    roomStore.joinRoom(code)
  })

  if (roomStore.roomCode) {
    loading.value = false
  } else {
    router.push('/lobby')
  }
}

onMounted(async () => {
  await reconnectToRoom()

  socket.on('rule_qa_answer', _onRuleAnswer)

  if (!roomStore.roomCode) {
    return
  }

  if (!gameStore.roleRevealed && gameStore.myRole) {
    showRoleReveal.value = true
    gameStore.markRoleRevealed()
    setTimeout(() => { showRoleReveal.value = false }, 5000)
  }
})

onUnmounted(() => {
  roomStore.unbindEvents()
  gameStore.unbindEvents()
  socket.off('rule_qa_answer', _onRuleAnswer)
})

function handleChat(message) {
  gameStore.sendChat(message)
}

function goToLobby() {
  socket.emit('leave_room', { roomCode: roomStore.roomCode })
  router.push('/lobby')
}

function returnToRoom() {
  socket.emit('reset_game')
  router.push(`/room/${roomStore.roomCode}`)
}
</script>

<style scoped>
/* C13: indicate the role badge is clickable to re-view role details */
.my-role {
  cursor: pointer;
}

/* 游戏规则按钮 */
.btn-game-rule {
  padding: 6px 14px;
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
  border-radius: var(--radius-md);
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.btn-game-rule:hover {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
  color: #bbf7d0;
}

/* ===== 规则问答弹窗 ===== */
.rule-modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
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
  border-radius: var(--radius-2xl, 20px);
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
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
  border-radius: var(--radius-md, 8px);
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
  color: #f87171;
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
  color: var(--ai-secondary, #22c55e);
  line-height: 1.4;
}

.qa-text :deep(h2) { font-size: 1rem; }
.qa-text :deep(h3) { font-size: 0.95rem; }
.qa-text :deep(h4) { font-size: 0.9rem; }

.qa-text :deep(strong) {
  color: var(--ai-primary, #14b8a6);
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
  color: var(--ai-secondary, #22c55e);
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
  border-color: var(--ai-secondary, #22c55e);
  color: var(--ai-secondary, #22c55e);
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
  background: var(--glass-bg, var(--bg-primary));
}

.rule-input {
  flex: 1;
  padding: 10px 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-color, rgba(148, 163, 184, 0.2));
  border-radius: var(--radius-md, 8px);
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
  border-color: var(--ai-secondary, #22c55e);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.rule-input:disabled {
  opacity: 0.6;
}

.rule-submit-btn {
  padding: 10px 20px;
  flex-shrink: 0;
  white-space: nowrap;
  background: linear-gradient(135deg, var(--ai-primary, #14b8a6), var(--ai-secondary, #22c55e));
  border: none;
  border-radius: var(--radius-md, 8px);
  color: white;
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
