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

    <div class="game-spectator-strip">
      <SpectatorBar :spectators="roomStore.spectators" :watching="roomStore.isSpectator" />
    </div>

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
        <div class="my-role spectator-role" v-if="roomStore.isSpectator">
          <span class="role-emoji">👁️</span>
          <span class="role-name">观众</span>
        </div>
        <div
          class="my-role"
          v-else-if="gameStore.myRole"
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
        <button
          v-if="roomStore.isSpectator"
          class="btn-game-rule"
          type="button"
          @click="insightOpen = !insightOpen"
        >
          全知
        </button>
        <button v-if="canReviseVote" class="btn-game-rule" type="button" @click="voteSettled = false">修改投票</button>
        <div class="game-message" v-if="gameStore.message">{{ gameStore.message }}</div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="game-main" :class="`players-${roomStore.maxPlayers}`">
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
                :showRoles="gameStore.isEnd || roomStore.isSpectator"
                :roles="displayRoles"
                :maxPlayers="roomStore.maxPlayers"
                :candidates="gameStore.candidates"
                :currentSpeaker="gameStore.currentSpeaker"
                :inspect-ai="roomStore.isSpectator"
                @select-ai="openAiThought"
              />
            </div>
          </section>

      <div class="game-center">
        <section class="game-section chat-section">
          <div v-if="speakOpen" class="speak-bar">
            <span>轮到你发言</span>
            <button type="button" class="btn btn-primary" @click="gameStore.nextSpeaker()">结束发言</button>
            <button type="button" class="btn btn-secondary" @click="gameStore.skipSpeaking()">跳过</button>
          </div>
          <div v-if="wolfBoard" class="speak-bar wolf-board">
            <span v-for="choice in wolfBoard.choices" :key="choice.playerId">
              {{ choice.playerName }} → {{ choice.targetName || '未选' }}
            </span>
          </div>
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
            :observer="roomStore.isSpectator"
            @send="handleChat" 
          />
        </section>
      </div>
    </div>

    <div v-if="decisionOpen" class="decision-mask">
      <div class="decision-sheet" role="dialog" aria-modal="true">
        <div class="decision-sheet-head">
          <span>{{ decisionTitle }}</span>
          <button v-if="nightOpen && nightSettledAction === 'check' && gameStore.seerResult" class="decision-close" type="button" @click="nightSettled = true">知道了</button>
          <button v-else-if="insightOpen && !choiceOpen" class="decision-close" type="button" @click="insightOpen = false">关闭</button>
        </div>
        <div v-if="roomStore.isSpectator && insightOpen" class="spectator-insight">
          <p v-if="gameStore.currentNightRole?.message" class="insight-now">{{ gameStore.currentNightRole.message }}</p>
          <div v-if="gameStore.spectatorVotes.length" class="insight-block">
            <div class="insight-label">本轮投票</div>
            <p v-for="(vote, index) in gameStore.spectatorVotes" :key="`${vote.voterName}-${index}`">
              {{ vote.voterName }} → {{ vote.targetName }}
            </p>
          </div>
          <div class="insight-block">
            <div class="insight-label">行动记录</div>
            <p v-if="!gameStore.spectatorHistory.length" class="insight-empty">对局开始后，这里会显示全部身份行动</p>
            <p v-for="(item, index) in gameStore.spectatorHistory" :key="`${item.night}-${index}`">
              <span v-if="item.night">第{{ item.night }}夜 · </span>{{ item.detail }}
            </p>
          </div>
        </div>
        <NightPanel
          v-if="nightMounted"
          v-show="nightOpen"
          :prompt="gameStore.nightActionPrompt"
          :seerResult="gameStore.seerResult"
          :currentNightRole="gameStore.currentNightRole"
          :werewolf-vote-state="gameStore.werewolfVoteState"
          @action="gameStore.submitNightAction"
          @settled="onNightSettled"
          @revise="nightSettled = false"
        />
        <HunterPanel
          v-if="hunterMounted"
          v-show="hunterOpen"
          :prompt="gameStore.hunterPrompt"
          @shoot="gameStore.submitHunterShoot"
          @settled="hunterSettled = true"
        />
        <VotePanel
          v-if="voteMounted"
          v-show="voteOpen"
          :candidates="gameStore.candidates"
          :votedCount="gameStore.votedCount"
          :totalVoters="gameStore.totalVoters"
          :key="voteRound"
          :existingVote="gameStore.myVote"
          @vote="gameStore.submitVote"
          @settled="voteSettled = true"
        />
      </div>
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
    <div v-if="thoughtPlayer" class="thought-mask" @click.self="thoughtPlayer = null">
      <div class="thought-card">
        <div class="thought-head">
          <h3>{{ thoughtPlayer.username }} 的思考</h3>
          <button type="button" @click="thoughtPlayer = null">关闭</button>
        </div>
        <p v-if="!playerThoughts.length" class="thought-empty">还没有思考记录。等这名 AI 行动或发言后，这里会显示推理过程。</p>
        <article v-for="item in playerThoughts" :key="item.id" class="thought-item">
          <span>第 {{ item.night || 1 }} 夜 · {{ item.kind }}<template v-if="item.summary"> · {{ item.summary }}</template></span>
          <p>{{ item.reasoning }}</p>
        </article>
      </div>
    </div>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useGameStore } from '../stores/game'
import { useRoomStore } from '../stores/room'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import PlayerList from '../components/PlayerList.vue'
import ChatBox from '../components/ChatBox.vue'
import SpectatorBar from '../components/SpectatorBar.vue'
import RoleReveal from '../components/RoleReveal.vue'
import Countdown from '../components/Countdown.vue'
import NightPanel from '../components/NightPanel.vue'
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
const thoughtPlayer = ref(null)

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

const insightOpen = ref(false)
const nightSettled = ref(false)
const nightSettledAction = ref('')
const voteSettled = ref(false)
const voteRound = ref(0)
const hunterSettled = ref(false)

watch(() => gameStore.nightActionPrompt, (prompt) => {
  nightSettled.value = !!prompt?.alreadyDone
  if (!prompt?.alreadyDone) nightSettledAction.value = ''
})

watch(() => gameStore.phase, (phase) => {
  if (phase === 'VOTE') voteSettled.value = !!gameStore.myVote
  else voteSettled.value = false
})

watch(() => gameStore.message, () => {
  if (gameStore.phase === 'VOTE' && !gameStore.myVote && gameStore.candidates.length > 0) {
    voteSettled.value = false
    voteRound.value += 1
  }
})

watch(() => gameStore.hunterPrompt, () => {
  hunterSettled.value = false
})

const nightMounted = computed(() => !roomStore.isSpectator && gameStore.isNight && !!gameStore.myPlayer?.isAlive && !!gameStore.nightActionPrompt)
const nightOpen = computed(() => nightMounted.value && !nightSettled.value)
const voteMounted = computed(() => !roomStore.isSpectator && gameStore.isVote && !!gameStore.myPlayer?.isAlive)
const voteOpen = computed(() => voteMounted.value && !voteSettled.value)
const hunterMounted = computed(() => !roomStore.isSpectator && !!gameStore.hunterPrompt)
const hunterOpen = computed(() => hunterMounted.value && !hunterSettled.value)
const speakOpen = computed(() => !roomStore.isSpectator && gameStore.isDay && !!gameStore.myPlayer?.isAlive && gameStore.currentSpeaker === mySocketId.value)
const choiceOpen = computed(() => nightOpen.value || voteOpen.value || hunterOpen.value)
const decisionOpen = computed(() => choiceOpen.value || (roomStore.isSpectator && insightOpen.value))
const canReviseVote = computed(() => voteMounted.value && voteSettled.value)
const wolfBoard = computed(() => {
  if (roomStore.isSpectator || gameStore.myRole !== 'werewolf' || !gameStore.isNight) return null
  const state = gameStore.werewolfVoteState
  if (!state?.choices?.length) return null
  return state
})
const decisionTitle = computed(() => {
  if (nightOpen.value) return '夜晚行动'
  if (hunterOpen.value) return '猎人开枪'
  if (voteOpen.value) return '投票放逐'
  return '全知视角'
})

function onNightSettled(action) {
  nightSettledAction.value = action || ''
  if (action === 'check') return
  nightSettled.value = true
}

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

const displayRoles = computed(() => {
  if (roomStore.isSpectator) return gameStore.spectatorRoles
  return gameOverRoles.value
})

const playerThoughts = computed(() => {
  if (!thoughtPlayer.value) return []
  const id = thoughtPlayer.value.id || thoughtPlayer.value.socketId
  return gameStore.spectatorThoughts.filter(item => item.playerId === id)
})

function openAiThought(player) {
  thoughtPlayer.value = player
}

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
    if (roomStore.isSpectator) roomStore.joinAsSpectator(code)
    else roomStore.joinRoom(code)
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

  if (!roomStore.isSpectator && !gameStore.roleRevealed && gameStore.myRole) {
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
  roomStore.leaveRoom()
  router.push('/lobby')
}

function returnToRoom() {
  if (!roomStore.isSpectator) socket.emit('reset_game')
  router.push(`/room/${roomStore.roomCode}`)
}
</script>

<style scoped>
.decision-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  background: rgba(16, 18, 24, 0.55);
  backdrop-filter: blur(4px);
}

.decision-sheet {
  width: min(520px, 100%);
  max-height: min(78dvh, 720px);
  overflow: auto;
  padding: 16px 16px 20px;
  border-radius: 22px 22px 16px 16px;
  background: var(--bg-card);
  border: var(--border-thin);
  box-shadow: 0 24px 60px rgba(16, 18, 24, 0.35);
}

.decision-sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  font-family: var(--font-display);
  font-size: 1.15rem;
  letter-spacing: 0.12em;
  color: var(--text-primary);
}

.speak-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 10px;
  border-bottom: var(--border-thin);
  font-family: var(--font-display);
  letter-spacing: 0.08em;
}

.speak-bar .btn {
  min-height: 36px;
  padding: 0 12px;
}

.wolf-board {
  flex-wrap: wrap;
  font-family: var(--font-body);
  letter-spacing: 0;
  font-size: 13px;
}

.decision-close {
  border: var(--border-medium);
  background: transparent;
  color: var(--text-secondary);
  border-radius: 999px;
  min-height: 36px;
  padding: 0 14px;
  font-family: var(--font-sans);
  cursor: pointer;
}

@media (min-width: 769px) {
  .decision-mask {
    align-items: center;
  }

  .decision-sheet {
    border-radius: 22px;
  }
}

/* C13: indicate the role badge is clickable to re-view role details */
.my-role {
  cursor: pointer;
}

.spectator-role {
  cursor: default;
}

.game-spectator-strip {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: flex-end;
  padding: 10px 24px 0;
}

.game-spectator-strip:not(:has(.spectator-badge)):not(:has(option:nth-child(2))) {
  display: none;
}

.game-spectator-strip :deep(.spectator-bar) {
  margin-bottom: 0;
}

.spectator-insight {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 2px 8px;
  max-height: 280px;
  overflow: auto;
}

.insight-title {
  font-weight: 700;
  color: var(--text-primary);
}

.insight-now {
  margin: 0;
  color: #7dd3fc;
  font-size: 0.86rem;
}

.insight-label {
  font-size: 0.78rem;
  font-weight: 700;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.insight-block p {
  margin: 0 0 4px;
  font-size: 0.86rem;
  line-height: 1.45;
  color: var(--text-primary);
}

.insight-empty {
  color: var(--text-secondary);
}

.thought-mask {
  position: fixed;
  inset: 0;
  z-index: 1400;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.thought-card {
  width: min(560px, 100%);
  max-height: 75vh;
  overflow: auto;
  background: var(--bg-card);
  border: var(--border-thin);
  border-radius: var(--radius-xl);
  padding: 18px;
}

.thought-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.thought-head h3 {
  margin: 0;
  font-size: 1.05rem;
}

.thought-head button {
  border: var(--border-thin);
  background: var(--bg-secondary);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: 6px 10px;
  cursor: pointer;
}

.thought-item {
  padding: 10px 0;
  border-top: var(--border-thin);
}

.thought-item span {
  display: block;
  margin-bottom: 6px;
  color: var(--text-secondary);
  font-size: 0.8rem;
}

.thought-item p,
.thought-empty {
  margin: 0;
  line-height: 1.5;
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
  background: linear-gradient(160deg, var(--ai-glow), transparent 70%);
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
  border-color: var(--ai-secondary);
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
}

.rule-input:disabled {
  opacity: 0.6;
}

.rule-submit-btn {
  padding: 10px 20px;
  flex-shrink: 0;
  white-space: nowrap;
  background: var(--ai-primary);
  border: none;
  border-radius: var(--radius-md, 8px);
  color: var(--on-accent);
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.rule-submit-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: var(--shadow-glow-ai);
}

.rule-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  text-align: center;
  color: var(--text-secondary);
  font-size: 0.92rem;
}

@media (max-width: 768px) {
  .rule-modal-mask {
    padding: 0;
    align-items: flex-end;
  }

  .rule-modal {
    max-width: none;
    max-height: min(92dvh, 100%);
    border-radius: 16px 16px 0 0;
  }

  .rule-modal-body {
    min-height: 140px;
  }

  .rule-input-row,
  .rule-quick-row {
    padding-left: 12px;
    padding-right: 12px;
  }

  .rule-input-row {
    padding-bottom: calc(14px + env(safe-area-inset-bottom, 0px));
  }
}
</style>
