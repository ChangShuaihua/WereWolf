<template>
  <div class="replay-page">
    <header class="replay-header">
      <button class="icon-button" title="返回房间" @click="returnToRoom">←</button>
      <div>
        <p class="eyebrow">对局 #{{ replay?.id || route.params.id }}</p>
        <h1>对局复盘</h1>
      </div>
      <span v-if="replay" class="result-mark" :class="replay.winner">
        {{ replay.winner === 'werewolf' ? '狼人阵营胜利' : '好人阵营胜利' }}
      </span>
    </header>

    <div v-if="loading" class="state-panel">正在整理复盘数据...</div>
    <div v-else-if="error" class="state-panel error-state">
      <strong>无法打开复盘</strong>
      <span>{{ error }}</span>
    </div>

    <main v-else-if="replay" class="replay-content">
      <section class="summary-band">
        <div class="summary-copy">
          <span class="summary-label">AI 赛后点评</span>
          <h2>{{ replay.analysis.verdict }}</h2>
          <p v-if="replay.analysis.turningPoint">关键转折：{{ replay.analysis.turningPoint.text }}</p>
        </div>
        <dl class="match-stats">
          <div><dt>房间</dt><dd>{{ replay.roomCode }}</dd></div>
          <div><dt>玩家</dt><dd>{{ replay.playerCount }} 人</dd></div>
          <div><dt>时长</dt><dd>{{ formatDuration(replay.duration) }}</dd></div>
          <div><dt>MVP</dt><dd>{{ replay.analysis.mvp || '暂无' }}</dd></div>
        </dl>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div><span class="section-index">01</span><h2>身份与结果</h2></div>
        </div>
        <div class="player-table">
          <div v-for="player in replayPlayers" :key="player.id" class="player-row">
            <span class="seat">{{ player.username }}</span>
            <span class="role" :class="player.role">{{ player.roleName }}</span>
            <span>{{ player.isAlive ? '存活' : '出局' }}</span>
            <strong :class="player.isWinner ? 'won' : 'lost'">{{ player.isWinner ? '胜利' : '失败' }}</strong>
          </div>
        </div>
      </section>

      <section class="section-block">
        <div class="section-heading">
          <div><span class="section-index">02</span><h2>投票关系</h2></div>
          <span class="section-note">箭头越粗，重复投票越多</span>
        </div>
        <div v-if="voteEdges.length" class="vote-board">
          <div v-for="edge in voteEdges" :key="`${edge.source}-${edge.target}`" class="vote-edge">
            <span class="voter">{{ edge.source }}</span>
            <span class="edge-line" :style="{ height: `${Math.min(8, 2 + edge.count * 2)}px` }"></span>
            <span class="arrow">→</span>
            <span class="target">{{ edge.target }}</span>
            <span class="vote-count">{{ edge.count }} 次</span>
          </div>
        </div>
        <div v-else class="empty-inline">本局没有有效投票记录</div>
      </section>

      <section class="analysis-grid">
        <div class="section-block highlights">
          <div class="section-heading"><div><span class="section-index">03</span><h2>关键发现</h2></div></div>
          <ol>
            <li v-for="item in replay.analysis.highlights" :key="item">{{ item }}</li>
          </ol>
        </div>

        <div class="section-block timeline-block">
          <div class="section-heading"><div><span class="section-index">04</span><h2>行动时间线</h2></div></div>
          <div class="timeline">
            <article v-for="event in replay.analysis.timeline" :key="event.id" class="timeline-event">
              <div class="timeline-dot"></div>
              <div>
                <span class="event-meta">第 {{ event.night || 1 }} 天 · {{ event.label }}</span>
                <p>{{ event.detail }}</p>
              </div>
            </article>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'

const route = useRoute()
const router = useRouter()
const replay = ref(null)
const loading = ref(true)
const error = ref('')

const voteEdges = computed(() => replay.value?.analysis?.voteGraph?.edges || [])
const replayPlayers = computed(() => replay.value?.replay?.players || [])

onMounted(async () => {
  try {
    const { data } = await api.get(`/replays/${route.params.id}`)
    replay.value = data
  } catch (err) {
    error.value = err.response?.data?.message || '复盘数据加载失败'
  } finally {
    loading.value = false
  }
})

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60)
  return `${minutes}分${seconds % 60}秒`
}

function returnToRoom() {
  const roomCode = replay.value?.roomCode || route.query.room
  if (roomCode) {
    router.push(`/room/${roomCode}`)
    return
  }
  router.back()
}
</script>

<style scoped>
.replay-page { min-height: 100%; padding: 32px clamp(18px, 5vw, 72px) 64px; background: var(--bg-primary); color: var(--text-primary); }
.replay-header { max-width: 1180px; margin: 0 auto 28px; display: grid; grid-template-columns: 44px 1fr auto; gap: 16px; align-items: center; }
.icon-button { width: 40px; height: 40px; border: var(--border-medium); border-radius: var(--radius-sm); background: var(--bg-secondary); color: var(--text-primary); font-size: 22px; cursor: pointer; }
.eyebrow, .summary-label, .section-index { color: var(--ai-primary); font-size: 12px; font-weight: 800; text-transform: uppercase; }
.replay-header h1 { font-size: 28px; line-height: 1.2; }
.result-mark { padding: 8px 12px; border-radius: var(--radius-sm); font-weight: 700; font-size: 13px; }
.result-mark.werewolf { color: var(--werewolf-light); background: var(--werewolf-glow); }
.result-mark.villager { color: var(--villager-light); background: var(--villager-glow); }
.replay-content, .state-panel { max-width: 1180px; margin: 0 auto; }
.state-panel { min-height: 260px; display: grid; place-content: center; gap: 6px; text-align: center; color: var(--text-secondary); }
.error-state strong { color: var(--status-error); }
.summary-band { display: grid; grid-template-columns: minmax(0, 1.6fr) minmax(320px, 1fr); gap: 40px; padding: 30px 0; border-top: var(--border-medium); border-bottom: var(--border-medium); }
.summary-copy h2 { margin: 8px 0; font-size: clamp(22px, 3vw, 34px); line-height: 1.35; letter-spacing: 0; }
.summary-copy p { color: var(--text-secondary); }
.match-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: var(--glass-border); border: var(--border-thin); }
.match-stats div { background: var(--bg-secondary); padding: 14px; }
.match-stats dt { color: var(--text-tertiary); font-size: 12px; }
.match-stats dd { margin: 2px 0 0; font-weight: 750; }
.section-block { padding: 30px 0; border-bottom: var(--border-medium); }
.section-heading { display: flex; justify-content: space-between; align-items: end; margin-bottom: 18px; }
.section-heading > div { display: flex; align-items: baseline; gap: 10px; }
.section-heading h2 { font-size: 20px; }
.section-note { color: var(--text-tertiary); font-size: 12px; }
.player-table { display: grid; grid-template-columns: repeat(2, 1fr); border-top: var(--border-thin); }
.player-row { display: grid; grid-template-columns: 1fr 1fr 58px 48px; gap: 12px; padding: 13px 12px; border-bottom: var(--border-thin); color: var(--text-secondary); font-size: 14px; }
.seat { color: var(--text-primary); font-weight: 700; }.role { color: var(--ai-light); }.role.werewolf { color: var(--werewolf-light); }.won { color: var(--status-success); }.lost { color: var(--text-tertiary); }
.vote-board { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 28px; }
.vote-edge { min-width: 0; display: grid; grid-template-columns: minmax(50px, 1fr) minmax(24px, 2fr) 20px minmax(50px, 1fr) 42px; gap: 8px; align-items: center; padding: 10px 0; }
.voter, .target { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 650; }.target { color: var(--werewolf-light); }.edge-line { width: 100%; min-height: 2px; background: var(--ai-primary); border-radius: 2px; }.arrow, .vote-count { color: var(--text-tertiary); }.vote-count { font-size: 12px; }
.empty-inline { padding: 30px; text-align: center; color: var(--text-tertiary); background: var(--bg-secondary); }
.analysis-grid { display: grid; grid-template-columns: minmax(260px, .8fr) minmax(0, 1.6fr); gap: 40px; }
.highlights ol { list-style: none; counter-reset: insight; display: grid; gap: 14px; }.highlights li { counter-increment: insight; padding: 14px 0 14px 42px; border-bottom: var(--border-thin); position: relative; }.highlights li::before { content: counter(insight, decimal-leading-zero); position: absolute; left: 0; color: var(--ai-primary); font-family: var(--font-mono); font-weight: 800; }
.timeline { max-height: 440px; overflow-y: auto; padding-left: 10px; }.timeline-event { display: grid; grid-template-columns: 16px 1fr; gap: 12px; min-height: 72px; position: relative; }.timeline-event::before { content: ''; position: absolute; left: 5px; top: 13px; bottom: -4px; width: 1px; background: var(--glass-border); }.timeline-event:last-child::before { display: none; }.timeline-dot { width: 11px; height: 11px; margin-top: 5px; border-radius: 50%; background: var(--ai-primary); box-shadow: 0 0 0 4px var(--ai-glow); z-index: 1; }.event-meta { color: var(--ai-light); font-size: 12px; font-weight: 700; }.timeline-event p { margin-top: 4px; color: var(--text-secondary); font-size: 14px; }
@media (max-width: 760px) { .replay-page { padding-top: 20px; }.replay-header { grid-template-columns: 40px 1fr; }.result-mark { grid-column: 2; justify-self: start; }.summary-band, .analysis-grid { grid-template-columns: 1fr; gap: 20px; }.player-table, .vote-board { grid-template-columns: 1fr; }.player-row { grid-template-columns: 1fr 1fr 46px 42px; gap: 6px; }.section-note { display: none; } }
</style>
