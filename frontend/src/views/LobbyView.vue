<template>
  <div class="lobby">
    <div class="lobby-bg">
      <div class="bg-gradient"></div>
      <div class="bg-pattern"></div>
    </div>

    <div class="lobby-content">
      <section class="hero-section">
        <div class="hero-text">
          <div class="hero-badge">
            <span class="badge-dot"></span>
            <span>在线玩家：{{ totalPlayers }}</span>
          </div>
          <h1 class="hero-title">
            <span class="title-gradient">欢迎来到</span>
            <br />
            Werewolf AI 游戏大厅
          </h1>
          <p class="hero-desc">选择你的游戏模式，或使用 AI 智能体开启一场精彩的对局</p>
        </div>
        <div class="hero-stats">
          <div class="stat-card">
            <div class="stat-value">{{ totalRooms }}</div>
            <div class="stat-label">进行中房间</div>
          </div>
          <div class="stat-card stat-ai">
            <div class="stat-value">{{ aiAgentCount }}</div>
            <div class="stat-label">AI 人格</div>
          </div>
          <div class="stat-card stat-werewolf">
            <div class="stat-value">3</div>
            <div class="stat-label">模式选择</div>
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
            <div class="mode-header">
              <div class="mode-icon">{{ mode.icon }}</div>
              <div class="mode-badge">{{ mode.players }}人</div>
            </div>
            <h3 class="mode-title">{{ mode.name }}</h3>
            <p class="mode-desc">{{ mode.description }}</p>
            <div class="mode-roles">
              <span v-for="role in mode.roles" :key="role" class="role-tag">{{ role }}</span>
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
            @click="handleJoinRoom(room.code)"
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
              </div>
            </div>
            <div class="room-footer">
              <span 
                v-if="room.playerCount >= room.maxPlayers" 
                class="room-status full"
              >
                已满员
              </span>
              <span v-else class="room-status waiting">
                <span class="status-dot"></span>
                等待中
              </span>
              <button 
                class="btn btn-sm" 
                :class="room.playerCount >= room.maxPlayers ? 'btn-secondary' : 'btn-primary'"
                :disabled="room.playerCount >= room.maxPlayers"
              >
                {{ room.playerCount >= room.maxPlayers ? '已满' : '加入' }}
              </button>
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

function _onRoomJoined(data) { router.push(`/room/${data.code}`) }
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
    radial-gradient(ellipse at 20% 0%, rgba(155, 109, 255, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(229, 57, 53, 0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 50% 50%, rgba(79, 140, 255, 0.05) 0%, transparent 60%);
}

.bg-pattern {
  position: absolute;
  inset: 0;
  background-image: 
    radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.03) 1px, transparent 0);
  background-size: 32px 32px;
}

.lobby-content {
  position: relative;
  z-index: 1;
  max-width: 1280px;
  margin: 0 auto;
  padding: 40px var(--space-8);
  display: flex;
  flex-direction: column;
  gap: 60px;
}

/* Hero Section */
.hero-section {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 40px 0;
  gap: 40px;
}

.hero-text {
  flex: 1;
}

.hero-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  background: rgba(20, 184, 166, 0.1);
  border: 1px solid rgba(20, 184, 166, 0.25);
  border-radius: var(--radius-full);
  font-size: 0.85rem;
  color: var(--ai-secondary);
  font-weight: 500;
  margin-bottom: 20px;
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
  font-size: 3.5rem;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
}

.title-gradient {
  background: linear-gradient(135deg, var(--text-primary) 0%, var(--ai-light) 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.hero-desc {
  font-size: 1.1rem;
  color: var(--text-secondary);
  max-width: 500px;
  margin: 0;
}

.hero-stats {
  display: flex;
  gap: 16px;
}

.stat-card {
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 20px 24px;
  text-align: center;
  min-width: 110px;
}

.stat-ai {
  border-color: rgba(20, 184, 166, 0.3);
  background: rgba(20, 184, 166, 0.08);
}

.stat-werewolf {
  border-color: rgba(229, 57, 53, 0.3);
  background: rgba(229, 57, 53, 0.08);
}

.stat-value {
  font-size: 2rem;
  font-weight: 800;
  background: linear-gradient(135deg, var(--text-primary), var(--text-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-ai .stat-value {
  background: linear-gradient(135deg, var(--ai-light), var(--ai-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-werewolf .stat-value {
  background: linear-gradient(135deg, var(--werewolf-light), var(--werewolf-primary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stat-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Section Headers */
.section-header {
  margin-bottom: 24px;
}

.section-title {
  font-size: 1.8rem;
  font-weight: 700;
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
}

.mode-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-xl);
  padding: 32px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.mode-card::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg, transparent 60%, var(--mode-glow, transparent));
  opacity: 0;
  transition: opacity 0.3s;
}

.mode-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.2);
  box-shadow: var(--shadow-lg);
}

.mode-6 { --mode-glow: rgba(79, 140, 255, 0.15); }
.mode-8 { --mode-glow: rgba(245, 185, 66, 0.15); }
.mode-12 { --mode-glow: rgba(229, 57, 53, 0.15); }

.mode-6:hover { border-color: rgba(79, 140, 255, 0.4); box-shadow: 0 8px 32px rgba(79, 140, 255, 0.2); }
.mode-8:hover { border-color: rgba(245, 185, 66, 0.4); box-shadow: 0 8px 32px rgba(245, 185, 66, 0.2); }
.mode-12:hover { border-color: rgba(229, 57, 53, 0.4); box-shadow: 0 8px 32px rgba(229, 57, 53, 0.2); }

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
  margin-bottom: 16px;
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
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0 0 8px;
}

.mode-desc {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin: 0 0 16px;
}

.mode-roles {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 24px;
  min-height: 32px;
}

.role-tag {
  padding: 4px 10px;
  background: rgba(0, 0, 0, 0.04);
  border: var(--border-thin);
  border-radius: var(--radius-full);
  font-size: 0.78rem;
  color: var(--text-secondary);
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
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 0 16px;
  transition: all 0.2s ease;
}

.search-input-wrapper:focus-within {
  border-color: rgba(155, 109, 255, 0.5);
  box-shadow: 0 0 0 3px rgba(155, 109, 255, 0.1);
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
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
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
  background: var(--glass-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: var(--border-medium);
  border-radius: var(--radius-lg);
  padding: 20px;
  cursor: pointer;
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.room-card:hover {
  transform: translateY(-2px);
  border-color: rgba(155, 109, 255, 0.4);
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
  background: rgba(155, 109, 255, 0.15);
  color: var(--ai-light);
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
  background: linear-gradient(135deg, rgba(155, 109, 255, 0.1), rgba(109, 92, 231, 0.05));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(155, 109, 255, 0.25);
  border-radius: var(--radius-xl);
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
  background: rgba(155, 109, 255, 0.2);
  color: var(--ai-light);
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.1em;
  margin-bottom: 12px;
}

.workshop-title {
  font-size: 1.8rem;
  font-weight: 700;
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
    gap: 32px;
  }
}

@media (max-width: 768px) {
  .lobby-content {
    padding: 24px 16px;
  }
  
  .modes-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-title {
    font-size: 2.5rem;
  }
  
  .hero-stats {
    width: 100%;
  }
  
  .stat-card {
    flex: 1;
    min-width: 0;
  }

  .room-search-bar {
    flex-direction: column;
    gap: 8px;
  }

  .btn-join-by-code {
    width: 100%;
  }
  
  .workshop-card {
    flex-direction: column;
    text-align: center;
    padding: 32px 24px;
  }
  
  .workshop-visual {
    width: 120px;
    height: 120px;
  }
}
</style>
