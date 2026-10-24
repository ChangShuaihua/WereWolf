<template>
  <div class="lobby">
    <div class="lobby-bg">
      <div class="bg-gradient"></div>
      <div class="bg-pattern"></div>
    </div>

    <div class="lobby-content">
      <section class="hero-section">
        <div class="hero-text">
          <h1 class="hero-title">
            <span class="title-gradient">欢迎回来，{{ userStore.user?.username }}</span>
            <br />
            Werewolf AI 游戏大厅
          </h1>
          <p class="hero-desc">
            选择对局人数，<span class="desc-break"></span>搭配AI智能体开启狼人杀对局
          </p>
        </div>
        <div class="hero-stats">
          <div class="stat-card">
            <div class="stat-value">{{ totalPlayers }}</div>
            <div class="stat-label"><span class="badge-dot"></span>在线玩家</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" :class="{ 'is-zero': totalRooms === 0 }">{{ totalRooms }}</div>
            <div class="stat-label">进行中房间</div>
          </div>
          <div class="stat-card">
            <div class="stat-value" :class="{ 'is-zero': aiAgentCount === 0 }">{{ aiAgentCount }}</div>
            <div class="stat-label">我的 AI 人格</div>
          </div>
        </div>
      </section>

      <section class="modes-section">
        <div class="section-header">
          <h2 class="section-title">选择游戏模式</h2>
          <p class="section-desc">不同人数，不同体验</p>
        </div>

        <div class="modes-grid">
          <div 
            v-for="mode in gameModes" 
            :key="mode.players"
            class="mode-card"
            :class="[
              `mode-${mode.players}`,
              { 'mode-hover-active': hoveredMode === mode.players }
            ]"
            @mouseenter="hoveredMode = mode.players"
            @mouseleave="hoveredMode = null"
          >
            <div class="mode-glow"></div>
            <div class="mode-count" aria-hidden="true">{{ mode.players }}</div>
            <div class="mode-body">
              <div class="mode-header">
                <div class="mode-icon">{{ mode.icon }}</div>
                <div class="mode-badge">{{ mode.players }}人</div>
              </div>
              <h3 class="mode-title">{{ mode.name }}</h3>
              <p class="mode-desc">{{ mode.description }}</p>
              <div class="mode-roles">
                <span v-for="role in mode.roles" :key="role" class="role-tag">{{ role }}</span>
              </div>
            </div>
            <div class="mode-actions">
              <button 
                class="btn btn-primary btn-block"
                :disabled="creating === mode.players"
                @click="handleCreateRoom(mode.players)"
              >
                <span v-if="creating === mode.players" class="btn-loading"></span>
                {{ creating === mode.players ? '创建中...' : '创建房间' }}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section class="rooms-section">
        <div class="section-header">
          <h2 class="section-title">当前房间</h2>
          <p class="section-desc">点击房间加入游戏</p>
        </div>

        <div class="room-search-bar">
          <div class="search-input-wrapper">
            <span class="search-icon">🔍</span>
            <input
              v-model="searchQuery"
              type="text"
              class="search-input"
              placeholder="输入房间号或房主名称搜索..."
              maxlength="10"
              @keyup.enter="handleSearchJoin"
            />
            <button
              v-if="searchQuery"
              class="search-clear-btn"
              @click="searchQuery = ''"
            >✕</button>
          </div>
          <button
            v-if="searchQuery"
            class="btn btn-primary btn-join-by-code"
            @click="handleSearchJoin"
          >
            直接加入
          </button>
        </div>

        <div class="rooms-grid">
          <div v-if="filteredRooms.length === 0" class="rooms-empty">
            <div class="empty-icon">{{ searchQuery ? '🔍' : '🎮' }}</div>
            <h3>{{ searchQuery ? '未找到匹配的房间' : '暂无房间' }}</h3>
            <p>{{ searchQuery ? '试试其他房间号，或输入完整房间号后按回车加入' : '创建一个房间开始你的第一场游戏吧' }}</p>
          </div>

          <div
            v-for="room in filteredRooms"
            :key="room.code"
            class="room-card"
            @click="room.inGame ? undefined : handleJoinRoom(room.code)"
          >
            <div class="room-header">
              <div class="room-code">{{ room.code }}</div>
              <div class="room-badge">
                {{ getPlayerMode(room.maxPlayers) }}
              </div>
            </div>
            <div class="room-body">
              <div class="room-host">
                <span class="host-avatar">👤</span>
                <span class="host-name">{{ room.hostUsername }}</span>
              </div>
              <div class="room-players">
                <div class="players-bar">
                  <div 
                    class="players-fill" 
                    :style="{ width: (room.playerCount / room.maxPlayers * 100) + '%' }"
                    :class="{ 'full': room.playerCount >= room.maxPlayers }"
                  ></div>
                </div>
                <span class="players-count">{{ room.playerCount }}/{{ room.maxPlayers }}</span>
                <span v-if="room.spectatorCount" class="spectator-count">👁️ {{ room.spectatorCount }}</span>
              </div>
            </div>
            <div class="room-footer">
              <span v-if="room.inGame" class="room-status playing">对局中</span>
              <span 
                v-else-if="room.playerCount >= room.maxPlayers" 
                class="room-status full"
              >
                已满员
              </span>
              <span v-else class="room-status waiting">
                <span class="status-dot"></span>
                等待中
              </span>
              <div class="room-card-actions">
                <button
                  class="btn btn-sm btn-secondary"
                  type="button"
                  @click.stop="handleSpectate(room.code)"
                >
                  观战
                </button>
                <button 
                  class="btn btn-sm" 
                  type="button"
                  :class="room.playerCount >= room.maxPlayers || room.inGame ? 'btn-secondary' : 'btn-primary'"
                  :disabled="room.playerCount >= room.maxPlayers || room.inGame"
                  @click.stop="handleJoinRoom(room.code)"
                >
                  {{ room.inGame ? '对局中' : room.playerCount >= room.maxPlayers ? '已满' : '加入' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section class="ai-workshop-entry">
        <div class="workshop-card">
          <div class="workshop-visual">
            <div class="orb orb-1"></div>
            <div class="orb orb-2"></div>
            <div class="orb orb-3"></div>
            <div class="workshop-icon">🤖</div>
          </div>
          <div class="workshop-content">
            <span class="workshop-label">AI 工坊</span>
            <h2 class="workshop-title">创造你的专属 AI 对手</h2>
            <p class="workshop-desc">自定义 AI 人格、发言风格和游戏策略，让游戏更有趣</p>
            <router-link to="/workshop" class="btn btn-ai">
              进入工坊
              <span class="arrow-icon">→</span>
            </router-link>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useRoomStore } from '../stores/room'
import { useUserStore } from '../stores/user'
import socket, { authenticate } from '../socket'
import api from '../api'
import { useConfirmDialog } from '../composables/useConfirm'

const router = useRouter()
const roomStore = useRoomStore()
const userStore = useUserStore()
const { showConfirm } = useConfirmDialog()

const rooms = ref([])
const creating = ref(0)
const hoveredMode = ref(null)
const searchQuery = ref('')

const filteredRooms = computed(() => {
  if (!searchQuery.value.trim()) return rooms.value
  const query = searchQuery.value.trim().toLowerCase()
  return rooms.value.filter(room => 
    room.code.toLowerCase().includes(query) ||
    (room.hostUsername && room.hostUsername.toLowerCase().includes(query))
  )
})

const gameModes = [
  { players: 6, icon: '👥', name: '六人局', description: '快节奏入门体验', roles: ['2狼人', '预言家', '女巫', '猎人', '村民'] },
  { players: 8, icon: '🔥', name: '八人局', description: '经典平衡配置', roles: ['3狼人', '预言家', '女巫', '守卫', '2村民'] },
  { players: 12, icon: '⚔️', name: '十二人局', description: '深度策略对决', roles: ['4狼人', '预言家', '女巫', '守卫', '猎人', '4村民'] }
]

const totalRooms = computed(() => rooms.value.length)
const totalPlayers = ref(1) // 至少包含自己
const aiAgentCount = ref(10)

function getPlayerMode(maxPlayers) {
  return gameModes.find(m => m.players === Number(maxPlayers))?.name || `${maxPlayers}人局`
}

function getZoneRooms(mode) {
  return rooms.value.filter(r => Number(r.maxPlayers) === Number(mode))
}

function _onRoomJoined(data) {
  if (data.isSpectator && data.gameActive) router.push(`/game/${data.code}`)
  else router.push(`/room/${data.code}`)
}
function _onRoomCreated(data) { rooms.value.unshift(data) }
function _onRoomDeleted(data) { rooms.value = rooms.value.filter(r => r.code !== data.code) }

onMounted(async () => {
  if (userStore.user) {
    const authPromise = authenticate() // W26: 统一无参签名
    if (!socket.connected) socket.connect()
    await authPromise
  } else {
    if (!socket.connected) socket.connect()
  }

  try {
    const { data: roomData } = await api.get('/rooms')
    rooms.value = roomData.rooms
  } catch (e) {}

  try {
    const { data: stats } = await api.get('/lobby-stats')
    totalPlayers.value = stats.onlineUsers || 1
    aiAgentCount.value = stats.aiAgentCount || 10
  } catch (e) {}

  roomStore.bindEvents()
  socket.on('room_joined', _onRoomJoined)
  socket.on('room_created', _onRoomCreated)
  socket.on('room_deleted', _onRoomDeleted)
})

onUnmounted(() => {
  socket.off('room_joined', _onRoomJoined)
  socket.off('room_created', _onRoomCreated)
  socket.off('room_deleted', _onRoomDeleted)
})

// 上次检查结果缓存：30s 内复用，避免反复调用大模型。
// 注意：只缓存「已放行」的结果（可用，或用户选择了「直接进入」）；
// 若用户选择「去配置」，组件会跳转设置页并被卸载，缓存自然失效，返回后会重新检测。
let _llmReadyCache = null
const LLM_READY_CACHE_MS = 30000

/**
 * 创建房间前的检查（你是房主，房间里 AI 玩家用你的 Key）：
 * 未绑定 Key 或绑定的 Key 不可用时弹框，让用户选择「去配置」或「直接进入」。
 * 加入房间不在此检查——房间 AI 用的是房主的 Key，与加入者无关。
 * @returns {Promise<boolean>} true = 可进入，false = 已跳转设置页
 */
async function ensureLLMReady() {
  if (_llmReadyCache && Date.now() - _llmReadyCache.at < LLM_READY_CACHE_MS) return true

  let status
  try {
    status = (await api.get('/settings/llm')).data
  } catch (e) {
    return true // 无法判断时不阻塞
  }

  // 未绑定 → 提示
  if (!status.ownKeySet) {
    const goConfig = await showConfirm({
      title: '未配置大模型 API',
      message: '你还没有配置大模型 API，房间里的 AI 玩家将使用本地模板逻辑。是否先去配置？',
      confirmText: '去配置',
      cancelText: '直接进入',
      type: 'warning',
    })
    if (goConfig) {
      router.push('/settings')
      return false
    }
    _llmReadyCache = { at: Date.now() }
    return true
  }

  // 已绑定 → 检测是否可用
  let ok = true
  try {
    ok = !!(await api.post('/settings/llm/test', {})).data?.ok
  } catch (e) {
    ok = false
  }

  if (ok) {
    _llmReadyCache = { at: Date.now() }
    return true
  }

  const goConfig = await showConfirm({
    title: '大模型 API 不可用',
    message: '你绑定的大模型 API 似乎无法连接，AI 玩家将使用本地模板逻辑。是否先去重新配置？',
    confirmText: '去配置',
    cancelText: '直接进入',
    type: 'warning',
  })
  if (goConfig) {
    router.push('/settings')
    return false
  }
  _llmReadyCache = { at: Date.now() }
  return true
}

async function handleCreateRoom(mode) {
  if (!(await ensureLLMReady())) return
  creating.value = mode
  roomStore.createRoom(mode)
  setTimeout(() => { creating.value = 0 }, 3000)
}

async function handleJoinRoom(code) {
  if (!code) return
  roomStore.joinRoom(code)
}

function handleSpectate(code) {
  if (!code) return
  roomStore.joinAsSpectator(code)
}

async function handleSearchJoin() {
  const code = searchQuery.value.trim().toUpperCase()
  if (code) {
    await handleJoinRoom(code)
  }
}
</script>

<style scoped>
.lobby {
  position: relative;
  min-height: 100%;
  background: var(--bg-primary);
}

.lobby-bg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 0;
}

.bg-gradient {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(7, 10, 18, 0.42) 0%, rgba(7, 10, 18, 0.08) 42%, rgba(7, 10, 18, 0.34) 100%),
    url('/bg.png') center / cover no-repeat;
}

.bg-pattern {
  display: none;
}

.lobby-content {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 24px var(--space-8) 40px;
  display: flex;
  flex-direction: column;
  gap: 32px;
}

/* Hero Section */
.hero-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 4px 0 0;
  gap: 32px;
}

.hero-text {
  flex: 1 1 520px;
  min-width: 0;
}

.badge-dot {
  width: 8px;
  height: 8px;
  background: var(--status-success);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--status-success);
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.hero-title {
  font-family: var(--font-display);
  font-size: clamp(2.15rem, 3.2vw, 2.85rem);
  font-weight: 600;
  line-height: 1.18;
  letter-spacing: 0.03em;
  margin: 0 0 16px;
  color: #f7f3ec;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
}

.title-gradient {
  color: #e7c27a;
}

.hero-desc {
  font-size: 1.1rem;
  color: #f7f3ec;
  text-shadow: 0 2px 16px rgba(0, 0, 0, 0.45);
  max-width: 500px;
  margin: 0;
}

.desc-break {
  display: none;
}

.mode-count {
  display: none;
}

.mode-body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}

.hero-stats {
  display: flex;
  gap: 12px;
  flex: 0 0 auto;
}

.stat-card {
  background: rgba(8, 10, 18, 0.78);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(198, 161, 94, 0.28);
  border-radius: var(--radius-lg);
  padding: 18px 22px;
  text-align: center;
  min-width: 124px;
}

.stat-value {
  font-family: var(--font-display);
  font-size: 2.2rem;
  font-weight: 600;
  color: #f7f3ec;
  letter-spacing: 0.04em;
}

.stat-value.is-zero {
  color: #b7b1a6;
}

.stat-label {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 0.85rem;
  color: #e4d9c8;
  margin-top: 4px;
}

.stat-label .badge-dot {
  width: 7px;
  height: 7px;
}

/* Section Headers */
.section-header {
  margin-bottom: 16px;
}

.section-title {
  font-family: var(--font-display);
  font-size: 1.85rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.section-desc {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0;
}

/* Modes Section */
.modes-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 24px;
  align-items: stretch;
}

.mode-card {
  position: relative;
  height: 100%;
  background: rgba(8, 12, 22, 0.32);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(198, 161, 94, 0.4);
  border-radius: var(--radius-xl);
  padding: 28px 28px 24px;
  transition: transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mode-card:hover,
.mode-card.mode-hover-active {
  transform: translateY(-6px);
  border-color: rgba(231, 194, 122, 0.9);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35), 0 0 22px rgba(176, 48, 42, 0.28);
}

.mode-card:hover .mode-actions .btn,
.mode-card.mode-hover-active .mode-actions .btn {
  border-color: rgba(231, 194, 122, 0.8);
  box-shadow: 0 0 16px rgba(231, 194, 122, 0.4), 0 0 26px rgba(176, 48, 42, 0.28);
  filter: brightness(1.08);
}

.mode-actions .btn {
  transition: box-shadow 0.2s ease, filter 0.2s ease, border-color 0.2s ease;
}

.mode-actions .btn:hover:not(:disabled) {
  box-shadow: 0 0 18px rgba(231, 194, 122, 0.55), 0 0 30px rgba(176, 48, 42, 0.4);
  filter: brightness(1.12);
}

.mode-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 60%, var(--mode-glow, transparent));
  opacity: 0;
  transition: opacity 0.3s;
}

.mode-6 { --mode-glow: rgba(231, 194, 122, 0.16); }
.mode-8 { --mode-glow: rgba(231, 194, 122, 0.16); }
.mode-12 { --mode-glow: rgba(176, 48, 42, 0.18); }

.mode-glow {
  position: absolute;
  top: -50%;
  right: -30%;
  width: 200px;
  height: 200px;
  background: radial-gradient(circle, var(--mode-glow, transparent) 0%, transparent 70%);
  pointer-events: none;
  opacity: 0.5;
}

.mode-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  min-height: 44px;
  margin-bottom: 14px;
}

.mode-icon {
  font-size: 2.5rem;
  filter: drop-shadow(0 4px 12px var(--shadow-md));
}

.mode-badge {
  padding: 4px 12px;
  background: var(--bg-secondary);
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.mode-6 .mode-badge { background: rgba(59, 130, 246, 0.15); color: var(--villager-secondary); }
.mode-8 .mode-badge { background: rgba(245, 158, 11, 0.15); color: var(--status-warning); }
.mode-12 .mode-badge { background: rgba(239, 68, 68, 0.15); color: var(--werewolf-secondary); }

.mode-title {
  font-family: var(--font-display);
  font-size: 1.65rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-primary);
  margin: 0 0 8px;
  min-height: 1.65rem;
}

.mode-desc {
  font-size: 0.9rem;
  color: #e4d9c8;
  margin: 0 0 16px;
  min-height: 1.4em;
}

.mode-roles {
  display: flex;
  flex-wrap: wrap;
  align-content: flex-start;
  gap: 8px;
  margin-bottom: 20px;
  min-height: 76px;
}

.role-tag {
  padding: 4px 10px;
  background: rgba(198, 161, 94, 0.16);
  border: 1px solid rgba(231, 194, 122, 0.48);
  border-radius: 999px;
  font-size: 0.75rem;
  line-height: 1.4;
  letter-spacing: 0.04em;
  color: #f6ead0;
}

.mode-actions {
  position: relative;
  z-index: 1;
  margin-top: auto;
}

/* Rooms Section */
.room-search-bar {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  align-items: center;
}

.search-input-wrapper {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  background: rgba(8, 12, 22, 0.34);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(198, 161, 94, 0.32);
  border-radius: var(--radius-lg);
  padding: 0 16px;
  transition: all 0.2s ease;
}

.search-input-wrapper:focus-within {
  border-color: var(--ai-primary);
  box-shadow: 0 0 0 3px var(--ai-glow);
}

.search-icon {
  font-size: 1.1rem;
  margin-right: 10px;
  opacity: 0.7;
}

.search-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  padding: 12px 0;
  font-size: 0.95rem;
  color: var(--text-primary);
  font-family: var(--font-mono);
  letter-spacing: 0.05em;
}

.search-input::placeholder {
  color: var(--text-tertiary);
  font-family: inherit;
  letter-spacing: normal;
}

.search-clear-btn {
  width: 24px;
  height: 24px;
  border: none;
  background: var(--bg-tertiary);
  border-radius: 50%;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.7rem;
  transition: all 0.2s;
  padding: 0;
}

.search-clear-btn:hover {
  background: var(--status-dead);
  color: white;
}

.btn-join-by-code {
  white-space: nowrap;
  padding: 12px 24px;
}

.rooms-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}

.rooms-empty {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 40px;
  background: rgba(8, 12, 22, 0.32);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(198, 161, 94, 0.32);
  border-radius: var(--radius-xl);
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 16px;
}

.rooms-empty h3 {
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.rooms-empty p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0;
}

.room-card {
  background: rgba(8, 12, 22, 0.32);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(198, 161, 94, 0.38);
  border-radius: var(--radius-lg);
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.room-card:hover {
  transform: translateY(-2px);
  border-color: color-mix(in srgb, var(--ai-primary) 45%, transparent);
  box-shadow: var(--shadow-md);
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.room-code {
  font-family: var(--font-mono);
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--ai-light);
  letter-spacing: 0.1em;
}

.room-badge {
  padding: 3px 10px;
  background: var(--ai-glow);
  color: var(--ai-secondary);
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  font-weight: 500;
}

.room-body {
  margin-bottom: 16px;
}

.room-host {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.host-avatar {
  font-size: 1rem;
}

.host-name {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.room-players {
  display: flex;
  align-items: center;
  gap: 12px;
}

.players-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.players-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--ai-primary), var(--ai-light));
  border-radius: var(--radius-full);
  transition: width 0.3s ease;
}

.players-fill.full {
  background: linear-gradient(90deg, var(--werewolf-primary), var(--werewolf-light));
}

.players-count {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: var(--font-mono);
}

.room-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.room-card-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.spectator-count {
  font-size: 0.78rem;
  color: var(--text-secondary);
  white-space: nowrap;
}

.room-status.playing {
  color: #7dd3fc;
}

.room-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  font-weight: 500;
}

.room-status.waiting {
  color: var(--status-success);
}

.room-status.full {
  color: var(--status-dead);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: currentColor;
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

/* AI Workshop Entry */
.ai-workshop-entry {
  margin-top: 20px;
}

.workshop-card {
  display: flex;
  align-items: center;
  gap: 48px;
  padding: 48px;
  background: linear-gradient(160deg, var(--ai-glow), transparent 62%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid color-mix(in srgb, var(--ai-primary) 28%, transparent);
  border-radius: var(--radius-xl);
  box-shadow: inset 0 1px 0 var(--hairline);
  position: relative;
  overflow: hidden;
}

.workshop-visual {
  position: relative;
  width: 160px;
  height: 160px;
  flex-shrink: 0;
}

.orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(1px);
}

.orb-1 {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  top: 20px;
  left: 20px;
  animation: orbFloat 4s ease-in-out infinite;
}

.orb-2 {
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, var(--werewolf-primary), var(--werewolf-secondary));
  top: 60px;
  right: 10px;
  animation: orbFloat 4s ease-in-out infinite 1s;
}

.orb-3 {
  width: 50px;
  height: 50px;
  background: linear-gradient(135deg, var(--villager-primary), var(--villager-secondary));
  bottom: 20px;
  left: 40px;
  animation: orbFloat 4s ease-in-out infinite 2s;
}

@keyframes orbFloat {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

.workshop-icon {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3rem;
  filter: drop-shadow(0 0 20px var(--ai-glow));
}

.workshop-content {
  flex: 1;
}

.workshop-label {
  display: inline-block;
  padding: 4px 12px;
  background: var(--ai-glow);
  color: var(--ai-secondary);
  border-radius: var(--radius-full);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  margin-bottom: 12px;
}

.workshop-title {
  font-family: var(--font-display);
  font-size: 1.9rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.workshop-desc {
  font-size: 1rem;
  color: var(--text-secondary);
  margin: 0 0 24px;
}

.arrow-icon {
  transition: transform 0.2s;
}

.btn-ai:hover .arrow-icon {
  transform: translateX(4px);
}

.btn-loading {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Responsive */
@media (max-width: 1024px) {
  .modes-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .hero-section {
    flex-direction: column;
    align-items: flex-start;
    justify-content: flex-start;
    gap: 24px;
  }

  /* 桌面横排时 520px 是宽度；竖排后会变成高度，把统计卡顶到屏幕底部。 */
  .hero-text {
    flex: none;
    width: 100%;
  }
}

@media (max-width: 768px) {
  .lobby-content {
    padding: 4px 16px 24px;
    gap: 22px;
  }

  .hero-section {
    gap: 16px;
    padding: 0;
  }

  .desc-break {
    display: block;
  }

  .hero-title {
    font-size: 1.7rem;
    letter-spacing: 0.02em;
    line-height: 1.25;
    margin-bottom: 8px;
  }

  .hero-desc,
  .section-desc {
    font-size: 0.92rem;
    max-width: none;
    line-height: 1.65;
  }

  .hero-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 100%;
    gap: 8px;
    margin-top: 16px;
  }

  .stat-card {
    min-width: 0;
    padding: 10px 6px;
  }

  .stat-value {
    font-size: 1.35rem;
    letter-spacing: 0;
  }

  .stat-label {
    font-size: 0.68rem;
    letter-spacing: 0.02em;
    line-height: 1.3;
  }

  .section-header {
    display: block;
    padding: 0;
    border-bottom: none;
    margin-bottom: 12px;
  }

  .section-title {
    font-size: 1.15rem;
    letter-spacing: 0.06em;
    margin-bottom: 2px;
  }

  .modes-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .mode-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    column-gap: 10px;
    row-gap: 10px;
    align-items: start;
    padding: 14px 14px 12px;
  }

  .mode-card:hover {
    transform: none;
    box-shadow: none;
  }

  .mode-count {
    display: block;
    font-family: var(--font-display);
    font-size: 2.15rem;
    font-weight: 600;
    line-height: 0.85;
    letter-spacing: -0.04em;
  }

  .mode-card.mode-6 { border-left: 3px solid var(--villager-primary); }
  .mode-card.mode-8 { border-left: 3px solid var(--ai-primary); }
  .mode-card.mode-12 { border-left: 3px solid var(--werewolf-primary); }
  .mode-card.mode-6 .mode-count { color: var(--villager-primary); }
  .mode-card.mode-8 .mode-count { color: var(--ai-primary); }
  .mode-card.mode-12 .mode-count { color: var(--werewolf-primary); }

  .mode-icon,
  .mode-badge,
  .mode-glow {
    display: none;
  }

  .mode-header {
    display: none;
  }

  .mode-title {
    font-size: 1.2rem;
    letter-spacing: 0.04em;
    margin-bottom: 2px;
  }

  .mode-desc {
    margin-bottom: 6px;
    font-size: 0.82rem;
  }

  .mode-roles {
    flex-wrap: wrap;
    gap: 6px;
    min-height: 0;
    margin-bottom: 0;
  }

  .role-tag {
    font-size: 0.68rem;
  }

  .role-tag:not(:last-child)::after {
    content: none;
  }

  .mode-actions {
    grid-column: 1 / -1;
    display: flex;
    justify-content: flex-end;
  }

  .mode-actions .btn {
    width: auto;
    min-width: 7.5rem;
    height: 40px;
    min-height: 40px;
  }

  .rooms-empty {
    padding: 28px 16px;
  }

  .room-search-bar {
    flex-direction: column;
    gap: 8px;
  }

  .btn-join-by-code {
    width: 100%;
    min-height: 44px;
  }

  .workshop-card {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
    gap: 0;
    padding: 20px 18px;
  }

  .workshop-visual {
    display: none;
  }

  .workshop-title {
    font-size: 1.35rem;
  }

  .workshop-desc {
    margin-bottom: 16px;
  }
}
</style>
