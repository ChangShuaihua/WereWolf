<template>
  <div class="chat-box">
    <div class="chat-messages" ref="chatContainer">
      <slot name="notice" />
      <div v-if="messages.length === 0" class="chat-empty">
        <span class="empty-icon">💬</span>
        <p>暂无消息，开始聊天吧</p>
      </div>
      <!-- W18: 使用 timestamp+username+index 组合 key，避免列表变动时复用错位 -->
      <div v-for="(msg, i) in messages" :key="(msg.timestamp || '') + '_' + (msg.username || '') + '_' + i" class="chat-msg" :class="{ 'ai-msg': msg.isAI, 'system-msg': msg.isSystem && !msg.isReplay }">
        <!-- Replay Card -->
        <div v-if="msg.isReplay && msg.replayData" class="replay-card">
          <div class="replay-header">
            <span class="replay-title">{{ msg.replayData.title }}</span>
          </div>
          <div class="replay-summary">{{ msg.replayData.summary }}</div>
          
          <div class="replay-section" v-if="msg.replayData.roles.werewolves?.length">
            <div class="replay-section-title">🐺 狼人阵营</div>
            <div class="replay-players">
              <span v-for="(w, idx) in msg.replayData.roles.werewolves" :key="'w'+idx" class="replay-player werewolf">{{ w }}</span>
            </div>
          </div>
          
          <div class="replay-section" v-if="msg.replayData.roles.civilians?.length">
            <div class="replay-section-title">👤 村民阵营</div>
            <div class="replay-players">
              <span v-if="msg.replayData.roles.seer" class="replay-player seer">🔮 {{ msg.replayData.roles.seer }}</span>
              <span v-if="msg.replayData.roles.witch" class="replay-player witch">🧪 {{ msg.replayData.roles.witch }}</span>
              <span v-if="msg.replayData.roles.guard" class="replay-player guard">🛡️ {{ msg.replayData.roles.guard }}</span>
              <span v-if="msg.replayData.roles.hunter" class="replay-player hunter">🔫 {{ msg.replayData.roles.hunter }}</span>
              <span v-for="(c, idx) in msg.replayData.roles.civilians" :key="'c'+idx" class="replay-player civilian">{{ c }}</span>
            </div>
          </div>
          
          <div class="replay-section replay-result">
            <div class="replay-section-title">🏆 胜负结果</div>
            <div class="replay-winner">
              <span class="winner-label">胜利方</span>
              <span class="winner-name">{{ msg.replayData.result.winner }}</span>
            </div>
            <div class="replay-players">
              <span v-for="(w, idx) in msg.replayData.result.winners" :key="'win'+idx" class="replay-tag winner">{{ w }}</span>
              <span v-for="(l, idx) in msg.replayData.result.losers" :key="'lose'+idx" class="replay-tag loser">{{ l }}</span>
            </div>
          </div>
          
          <div class="replay-section" v-if="msg.replayData.history?.length">
            <div class="replay-section-title">📜 行动记录</div>
            <div class="replay-history">
              <div v-for="(night, nIdx) in msg.replayData.history" :key="'night'+nIdx" class="replay-night">
                <div class="replay-night-title">🌙 第{{ night.night }}夜</div>
                <div class="replay-events">
                  <div v-for="(evt, eIdx) in night.events" :key="'evt'+nIdx+'-'+eIdx" class="replay-event">
                    {{ evt.detail }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <span v-else-if="msg.isSystem" class="chat-system">{{ msg.message }}</span>
        <template v-else>
          <span class="chat-user">{{ msg.isAI ? '🤖 ' : '' }}{{ msg.username }}:</span>
          <span class="chat-text">{{ msg.message }}</span>
        </template>
      </div>
    </div>
    <div class="chat-foot">
    <div v-if="!canSpeak" class="chat-disabled-hint">
      {{ disabledHint }}
    </div>
    <form class="chat-input-wrapper" @submit.prevent="sendMsg" :class="{ 'is-disabled': !canSpeak }">
      <input 
        v-model="text" 
        :placeholder="canSpeak ? '输入消息...' : disabledHint"
        maxlength="200"
        class="chat-input-field"
        :disabled="!canSpeak"
      />
      <button type="submit" class="chat-send-btn" :disabled="!text.trim() || !canSpeak">
        <span>发送</span>
      </button>
    </form>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import socket from '../socket'

const props = defineProps({
  messages: { type: Array, default: () => [] },
  phase: { type: String, default: 'WAITING' },
  currentSpeaker: { type: String, default: null },
  isAlive: { type: Boolean, default: true },
  observer: { type: Boolean, default: false },
})

const emit = defineEmits(['send'])

const text = ref('')
const chatContainer = ref(null)

// Game phase labels
const PHASE_LABELS = {
  WAITING: '等待中',
  NIGHT: '夜晚',
  LAST_WILL: '死亡遗言',
  DISCUSSION: '自由讨论',
  DAY: '轮流发言',
  VOTE: '投票',
  END: '游戏结束',
}

// Check if player can speak
const canSpeak = computed(() => {
  const phase = props.phase
  const mySocketId = socket.id

  if (props.observer && phase !== 'WAITING') return false
  
  // Waiting phase: everyone can speak
  if (phase === 'WAITING') return true
  
  // Night, vote, end phases: no one can speak
  if (phase === 'NIGHT' || phase === 'VOTE' || phase === 'END') return false
  
  // Last will phase: only current dead speaker can speak
  if (phase === 'LAST_WILL') {
    return !props.isAlive && props.currentSpeaker === mySocketId
  }

  // Dead players cannot participate in ordinary discussion or ordered speaking.
  if (!props.isAlive) return false
  
  // Discussion phase: everyone can speak
  if (phase === 'DISCUSSION') return true
  
  // Day phase (ordered speaking): only current speaker can speak
  if (phase === 'DAY') {
    return props.currentSpeaker === mySocketId
  }
  
  return false
})

// Hint message when chat is disabled
const disabledHint = computed(() => {
  const phase = props.phase

  if (props.observer && phase !== 'WAITING') return '👁️ 观战中不能发言'
  
  if (phase === 'WAITING') return ''
  if (phase === 'NIGHT') return '🌙 夜晚阶段不能发言'
  if (phase === 'VOTE') return '🗳️ 投票阶段不能发言'
  if (phase === 'END') return '🏆 游戏已结束'
  if (phase === 'LAST_WILL') {
    if (!props.isAlive) return '💀 你已死亡，不能发言'
    return '💀 现在是其他人的死亡遗言阶段'
  }
  if (phase === 'DISCUSSION') {
    if (!props.isAlive) return '💀 你已死亡，不能发言'
    return ''
  }
  if (phase === 'DAY') {
    if (!props.isAlive) return '💀 你已死亡，不能发言'
    return '🎤 现在轮到其他人发言'
  }
  
  return '当前阶段不能发言'
})

function sendMsg() {
  if (!canSpeak.value) return
  const msg = text.value.trim()
  if (!msg) return
  emit('send', msg)
  text.value = ''
}

watch(() => props.messages.length, async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
})
</script>

<style scoped>
.chat-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--text-tertiary);
  gap: 8px;
}

.chat-empty .empty-icon {
  font-size: 2rem;
  opacity: 0.5;
}

.chat-empty p {
  margin: 0;
  font-size: 0.9rem;
}

.chat-msg {
  padding: 8px 10px;
  background: var(--bg-secondary);
  border: var(--border-thin);
  border-radius: 14px;
  font-size: 0.86rem;
  line-height: 1.45;
  overflow-wrap: break-word;
  word-break: normal;
  transition: background 0.2s;
}

.chat-msg:hover {
  background: var(--bg-tertiary);
}

.chat-msg.system-msg {
  background: transparent;
  border: none;
  border-radius: 0;
  padding: 4px 8px;
  box-shadow: none;
}

.chat-msg.system-msg:hover {
  background: transparent;
}

.chat-msg.ai-msg {
  background: var(--ai-glow);
  border-color: color-mix(in srgb, var(--ai-primary) 28%, transparent);
}

.chat-user {
  display: block;
  font-weight: 600;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--ai-light);
  margin: 0 0 2px;
}

.chat-text {
  color: var(--text-primary);
}

.chat-system {
  display: block;
  text-align: center;
  padding: 2px 0;
  background: transparent;
  border: none;
  border-radius: 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--text-tertiary);
  font-weight: 500;
}

.chat-foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex-shrink: 0;
}

.chat-input-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border-top: none;
  background: transparent;
  z-index: 1;
}

.chat-input-field {
  flex: 1 1 auto;
  min-width: 0;
  width: 100%;
  height: 40px;
  padding: 0 14px;
  background: rgba(8, 12, 22, 0.78);
  border: 1px solid rgba(198, 161, 94, 0.4);
  border-radius: var(--radius-md);
  color: #f4efe6;
  font-size: 0.88rem;
  font-family: var(--font-sans);
  outline: none;
  transition: all 0.2s;
}

.chat-input-field::placeholder {
  color: #b7b1a6;
}

.chat-input-field:hover {
  border-color: rgba(231, 194, 122, 0.72);
}

.chat-input-field:focus {
  border-color: var(--ai-primary);
  background: var(--bg-tertiary);
  box-shadow: 0 0 0 3px var(--ai-glow);
}

.chat-send-btn {
  flex: 0 0 auto;
  width: auto;
  min-width: 84px;
  height: 40px;
  padding: 0 18px;
  background: linear-gradient(135deg, var(--ai-primary), var(--ai-secondary));
  border: none;
  border-radius: var(--radius-md);
  color: var(--on-accent);
  font-size: 0.88rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s;
  font-family: var(--font-sans);
}

.chat-send-btn:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--ai-glow);
}

.chat-send-btn:disabled {
  opacity: 1;
  background: transparent;
  color: #e7c27a;
  border: 1px solid rgba(198, 161, 94, 0.45);
  cursor: not-allowed;
}

.chat-messages::-webkit-scrollbar {
  width: 6px;
}

.chat-messages::-webkit-scrollbar-track {
  background: transparent;
}

.chat-messages::-webkit-scrollbar-thumb {
  background: var(--text-tertiary);
  border-radius: 3px;
}

.chat-messages::-webkit-scrollbar-thumb:hover {
  background: var(--text-secondary);
}

/* Disabled hint */
.chat-disabled-hint {
  padding: 8px 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: var(--radius-md);
  font-size: 0.82rem;
  color: #f87171;
  text-align: center;
  font-weight: 500;
}

/* Chat input disabled state */
.chat-input-wrapper.is-disabled {
  opacity: 0.6;
}

.chat-input-wrapper.is-disabled .chat-input-field {
  background: var(--bg-secondary);
  cursor: not-allowed;
}

.chat-input-wrapper.is-disabled .chat-input-field:disabled {
  background: var(--bg-secondary);
  color: var(--text-tertiary);
  cursor: not-allowed;
}

.chat-input-wrapper.is-disabled .chat-input-field:disabled::placeholder {
  color: var(--text-tertiary);
}

.chat-input-wrapper.is-disabled .chat-send-btn {
  background: var(--bg-tertiary);
  cursor: not-allowed;
}

.chat-input-wrapper.is-disabled .chat-send-btn:disabled {
  opacity: 0.5;
}

/* Replay Card Styles */
.replay-card {
  background: rgba(8, 12, 22, 0.62);
  border: 1px solid rgba(198, 161, 94, 0.32);
  border-radius: 16px;
  padding: 18px 20px;
  margin: 4px 0 12px;
  box-shadow: none;
  max-width: 100%;
}

.replay-header {
  text-align: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid rgba(198, 161, 94, 0.28);
}

.replay-title {
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
  color: #e7c27a;
  letter-spacing: 0.16em;
}

.replay-summary {
  text-align: center;
  font-size: 1rem;
  color: #d9d0c2;
  margin-bottom: 14px;
}

.replay-section {
  margin-bottom: 12px;
  padding: 10px;
  background: rgba(15, 23, 42, 0.5);
  border-radius: 8px;
}

.replay-section-title {
  font-size: 1rem;
  font-weight: 600;
  color: #f4efe6;
  margin-bottom: 10px;
}

.replay-players {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.replay-player {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 500;
  background: rgba(51, 65, 85, 0.5);
  color: #e2e8f0;
}

.replay-player.werewolf {
  background: rgba(239, 68, 68, 0.2);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.replay-player.seer {
  background: rgba(59, 130, 246, 0.2);
  color: #93c5fd;
  border: 1px solid rgba(59, 130, 246, 0.3);
}

.replay-player.witch {
  background: rgba(168, 85, 247, 0.2);
  color: #d8b4fe;
  border: 1px solid rgba(168, 85, 247, 0.3);
}

.replay-player.guard {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.replay-player.hunter {
  background: rgba(249, 115, 22, 0.2);
  color: #fdba74;
  border: 1px solid rgba(249, 115, 22, 0.3);
}

.replay-player.civilian {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
  border: 1px solid rgba(148, 163, 184, 0.3);
}

.replay-section.replay-result {
  background: rgba(0, 0, 0, 0.2);
}

.replay-winner {
  text-align: center;
  margin-bottom: 10px;
}

.winner-label {
  display: inline-block;
  padding: 2px 10px;
  background: rgba(34, 197, 94, 0.2);
  color: #4ade80;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 600;
  margin-right: 8px;
}

.winner-name {
  font-size: 1rem;
  font-weight: 700;
  color: #4ade80;
}

.replay-tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 0.78rem;
}

.replay-tag.winner {
  background: rgba(34, 197, 94, 0.2);
  color: #86efac;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.replay-tag.loser {
  background: rgba(239, 68, 68, 0.15);
  color: #fca5a5;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.replay-history {
  max-height: 200px;
  overflow-y: auto;
}

.replay-night {
  margin-bottom: 10px;
}

.replay-night-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: #fbbf24;
  margin-bottom: 6px;
}

.replay-events {
  padding-left: 8px;
}

.replay-event {
  font-size: 0.95rem;
  line-height: 1.55;
  color: #e7e0d4;
  padding: 5px 0 5px 12px;
  margin: 2px 0;
  border-bottom: none;
  border-left: 2px solid rgba(198, 161, 94, 0.38);
}

.replay-event:last-child {
  border-bottom: none;
}

.replay-history::-webkit-scrollbar {
  width: 4px;
}

.replay-history::-webkit-scrollbar-track {
  background: transparent;
}

.replay-history::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.3);
  border-radius: 2px;
}

@media (min-width: 901px) {
  .chat-msg {
    padding: 12px 16px;
    font-size: 1.12rem;
    line-height: 1.6;
  }

  .chat-user {
    font-size: 1rem;
    margin-bottom: 4px;
  }

  .chat-system {
    font-size: 1.05rem;
    line-height: 1.55;
  }

  .chat-empty p {
    font-size: 1.05rem;
  }

  .chat-input-field,
  .chat-send-btn {
    height: 48px;
    font-size: 1.05rem;
    border-radius: 12px;
  }

  .chat-send-btn {
    min-width: 104px;
    padding: 0 22px;
  }

  .chat-disabled-hint {
    font-size: 1rem;
  }
}
</style>
