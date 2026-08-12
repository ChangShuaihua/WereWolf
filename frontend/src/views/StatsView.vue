<template>
  <div class="stats-page">
    <div class="stats-container">
      <!-- 个人积分卡片 -->
      <div class="card score-card" v-if="myStats">
        <div class="score-header">
          <span class="score-icon">🏆</span>
          <span class="score-title">我的积分</span>
        </div>
        <div class="score-main">
          <div class="score-value">{{ myStats.score }}</div>
          <div class="score-rank" v-if="myRank">排名 #{{ myRank }}</div>
        </div>
        <div class="score-details">
          <div class="detail-item">
            <span class="detail-label">总场次</span>
            <span class="detail-value">{{ myStats.totalGames }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">胜场</span>
            <span class="detail-value win">{{ myStats.totalWins }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">负场</span>
            <span class="detail-value lose">{{ myStats.totalLosses }}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">胜率</span>
            <span class="detail-value">{{ myStats.winRate }}%</span>
          </div>
        </div>
      </div>

      <!-- 标签切换 -->
      <div class="tabs">
        <button class="tab-btn" :class="{ active: activeTab === 'history' }" @click="activeTab = 'history'">
          📋 战绩记录
        </button>
        <button class="tab-btn" :class="{ active: activeTab === 'leaderboard' }" @click="activeTab = 'leaderboard'">
          🏅 排行榜
        </button>
      </div>

      <!-- 战绩列表 -->
      <div class="card list-card" v-show="activeTab === 'history'">
        <div v-if="historyLoading" class="loading">加载中...</div>
        <div v-else-if="history.records.length === 0" class="empty">暂无战绩记录</div>
        <div v-else>
          <div class="record-item" v-for="record in history.records" :key="record.id"
               @click="goReplay(record.id)">
            <div class="record-left">
              <div class="record-result" :class="record.isWinner ? 'win' : 'lose'">
                {{ record.isWinner ? '胜' : '负' }}
              </div>
              <div class="record-info">
                <div class="record-role">
                  <span class="role-tag">{{ record.roleName }}</span>
                  <span class="record-winner" :class="record.winner">
                    {{ record.winner === 'werewolf' ? '狼人胜' : '村民胜' }}
                  </span>
                </div>
                <div class="record-meta">
                  {{ record.playerCount }}人局 · {{ formatDuration(record.duration) }} · {{ formatDate(record.createdAt) }}
                </div>
              </div>
            </div>
            <div class="record-right">
              <span class="replay-link">查看复盘 →</span>
            </div>
          </div>

          <!-- 分页 -->
          <div class="pagination" v-if="history.total > history.limit">
            <button class="page-btn" :disabled="history.page <= 1" @click="loadHistory(history.page - 1)">
              上一页
            </button>
            <span class="page-info">{{ history.page }} / {{ Math.ceil(history.total / history.limit) }}</span>
            <button class="page-btn" :disabled="history.page * history.limit >= history.total" @click="loadHistory(history.page + 1)">
              下一页
            </button>
          </div>
        </div>
      </div>

      <!-- 排行榜 -->
      <div class="card list-card" v-show="activeTab === 'leaderboard'">
        <div v-if="leaderboardLoading" class="loading">加载中...</div>
        <div v-else-if="leaderboard.length === 0" class="empty">暂无排行数据</div>
        <div v-else>
          <div class="rank-item" v-for="(player, index) in leaderboard" :key="player.id"
               :class="{ 'rank-me': player.id === userStore.user?.id }">
            <div class="rank-num" :class="getRankClass(index)">{{ index + 1 }}</div>
            <div class="rank-name">{{ player.username }}</div>
            <div class="rank-stats">
              <span class="rank-score">{{ player.score }}分</span>
              <span class="rank-detail">{{ player.total_wins }}胜 {{ player.total_losses }}负</span>
              <span class="rank-winrate" v-if="player.total_games > 0">
                {{ Math.round((player.total_wins / player.total_games) * 100) }}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const activeTab = ref('history')
const myStats = ref({ score: 0, totalGames: 0, totalWins: 0, totalLosses: 0, winRate: 0 })
const myRank = ref(null)
const myStatsLoading = ref(false)
const myStatsError = ref(false)
const history = ref({ records: [], total: 0, page: 1, limit: 20 })
const historyLoading = ref(false)
const leaderboard = ref([])
const leaderboardLoading = ref(false)

async function loadMyStats() {
  myStatsLoading.value = true
  myStatsError.value = false
  try {
    const { data } = await api.get('/stats/me')
    myStats.value = data || { score: 0, totalGames: 0, totalWins: 0, totalLosses: 0, winRate: 0 }
    myRank.value = data?.rank || null
  } catch (err) {
    console.error('加载积分失败:', err)
    myStatsError.value = true
  } finally {
    myStatsLoading.value = false
  }
}

async function loadHistory(page = 1) {
  historyLoading.value = true
  try {
    const { data } = await api.get('/stats/history', { params: { page, limit: 20 } })
    history.value = data
  } catch (err) {
    console.error('加载战绩失败:', err)
  } finally {
    historyLoading.value = false
  }
}

async function loadLeaderboard() {
  leaderboardLoading.value = true
  try {
    const { data } = await api.get('/stats/leaderboard', { params: { limit: 50 } })
    leaderboard.value = data.leaderboard
  } catch (err) {
    console.error('加载排行榜失败:', err)
  } finally {
    leaderboardLoading.value = false
  }
}

function goReplay(id) {
  router.push(`/replay/${id}`)
}

function formatDuration(seconds) {
  if (!seconds) return '--'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}分${secs}秒`
}

function formatDate(dateStr) {
  if (!dateStr) return '--'
  const d = new Date(dateStr)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function getRankClass(index) {
  if (index === 0) return 'rank-gold'
  if (index === 1) return 'rank-silver'
  if (index === 2) return 'rank-bronze'
  return ''
}

onMounted(() => {
  loadMyStats()
  loadHistory()
  loadLeaderboard()
})
</script>

<style scoped>
.stats-page {
  width: 70vw;
  margin: 0 auto;
  padding: 24px 16px;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.card {
  background: var(--bg-secondary);
  border-radius: 16px;
  padding: 24px;
  border: var(--border-thin);
}

/* 积分卡片 */
.score-card {
  text-align: center;
  background: linear-gradient(135deg, var(--bg-secondary), var(--bg-tertiary));
}

.score-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-bottom: 12px;
}

.score-icon {
  font-size: 1.5rem;
}

.score-title {
  font-size: 1.1rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.score-main {
  margin-bottom: 20px;
}

.score-value {
  font-size: 3rem;
  font-weight: 800;
  color: var(--text-primary);
  line-height: 1.2;
}

.score-rank {
  font-size: 1rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

.score-details {
  display: flex;
  justify-content: space-around;
  gap: 12px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 60px;
}

.detail-label {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.detail-value {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--text-primary);
}

.detail-value.win {
  color: #16a34a;
}

.detail-value.lose {
  color: #dc2626;
}

/* 标签切换 */
.tabs {
  display: flex;
  gap: 8px;
}

.tab-btn {
  flex: 1;
  padding: 10px 16px;
  border-radius: 10px;
  border: var(--border-thin);
  background: var(--bg-secondary);
  color: var(--text-secondary);
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.2s;
}

.tab-btn:hover {
  background: var(--bg-tertiary);
}

.tab-btn.active {
  background: var(--ai-primary);
  color: #fff;
  border-color: var(--ai-primary);
}

/* 列表卡片 */
.list-card {
  padding: 16px;
  min-height: 300px;
}

.loading, .empty {
  text-align: center;
  padding: 48px 0;
  color: var(--text-secondary);
  font-size: 1rem;
}

/* 战绩记录 */
.record-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.2s;
  border-bottom: var(--border-thin);
}

.record-item:last-child {
  border-bottom: none;
}

.record-item:hover {
  background: var(--bg-tertiary);
}

.record-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.record-result {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  color: #fff;
}

.record-result.win {
  background: #16a34a;
}

.record-result.lose {
  background: #dc2626;
}

.record-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.record-role {
  display: flex;
  align-items: center;
  gap: 8px;
}

.role-tag {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}

.record-winner {
  font-size: 0.8rem;
  padding: 2px 8px;
  border-radius: 4px;
}

.record-winner.werewolf {
  background: rgba(220, 38, 38, 0.15);
  color: #dc2626;
}

.record-winner.villager {
  background: rgba(37, 99, 235, 0.15);
  color: #2563eb;
}

.record-meta {
  font-size: 0.8rem;
  color: var(--text-secondary);
}

.replay-link {
  font-size: 0.85rem;
  color: var(--ai-primary);
  white-space: nowrap;
}

/* 分页 */
.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 16px 0 4px;
}

.page-btn {
  padding: 6px 16px;
  border-radius: 8px;
  border: var(--border-thin);
  background: var(--bg-tertiary);
  color: var(--text-primary);
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.page-btn:hover:not(:disabled) {
  background: var(--ai-primary);
  color: #fff;
}

.page-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.page-info {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

/* 排行榜 */
.rank-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-radius: 10px;
  border-bottom: var(--border-thin);
  transition: background 0.2s;
}

.rank-item:last-child {
  border-bottom: none;
}

.rank-item:hover {
  background: var(--bg-tertiary);
}

.rank-item.rank-me {
  background: rgba(13, 148, 136, 0.1);
}

.rank-num {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  flex-shrink: 0;
}

.rank-num.rank-gold {
  background: #facc15;
  color: #78350f;
}

.rank-num.rank-silver {
  background: #cbd5e1;
  color: #334155;
}

.rank-num.rank-bronze {
  background: #d97706;
  color: #fff;
}

.rank-name {
  flex: 1;
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
}

.rank-stats {
  display: flex;
  align-items: center;
  gap: 12px;
}

.rank-score {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--text-primary);
}

.rank-detail {
  font-size: 0.85rem;
  color: var(--text-secondary);
}

.rank-winrate {
  font-size: 0.85rem;
  color: var(--ai-primary);
  font-weight: 600;
  min-width: 40px;
  text-align: right;
}
</style>
