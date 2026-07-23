<template>
  <div class="vote-panel">
    <p class="vote-title">🗳️ 请选择要放逐的玩家 ({{ votedCount }}/{{ totalVoters }})</p>

    <div v-if="!hasVoted && candidates.length > 0" class="target-grid">
      <button
        v-for="c in candidates"
        :key="c.id"
        class="btn btn-target btn-vote"
        :class="{ selected: selectedCandidate === c.id }"
        @click="selectCandidate(c.id)"
      >
        {{ c.username }}
      </button>
    </div>

    <div v-if="selectedCandidate && !hasVoted" class="action-confirm">
      <button class="btn btn-danger" @click="confirmVote">🗳️ 确认投票</button>
      <button class="btn btn-secondary" @click="selectedCandidate = null">取消</button>
    </div>

    <div v-if="hasVoted" class="vote-done">
      <p class="vote-message">✅ 你的投票已确认</p>
      <p class="vote-target">你投票给了 <strong>{{ votedTargetName }}</strong></p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  candidates: { type: Array, default: () => [] },
  votedCount: { type: Number, default: 0 },
  totalVoters: { type: Number, default: 0 },
})

const emit = defineEmits(['vote'])

const selectedCandidate = ref(null)
const hasVoted = ref(false)
const votedTargetId = ref(null)

const votedTargetName = computed(() => {
  if (!votedTargetId.value) return ''
  const target = props.candidates.find(c => c.id === votedTargetId.value)
  return target?.username || ''
})

function selectCandidate(id) {
  if (hasVoted.value) return
  selectedCandidate.value = selectedCandidate.value === id ? null : id
}

function confirmVote() {
  if (!selectedCandidate.value) return
  emit('vote', selectedCandidate.value)
  votedTargetId.value = selectedCandidate.value
  hasVoted.value = true
  selectedCandidate.value = null
}
</script>

<style scoped>
.vote-panel {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95));
  padding: 24px;
  border-radius: 16px;
  border: 1px solid rgba(239, 68, 68, 0.2);
  box-shadow: 0 4px 20px rgba(239, 68, 68, 0.1);
}

.vote-title {
  margin-bottom: 16px;
  font-weight: 600;
  color: #e2e8f0;
  font-size: 15px;
}

.target-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: center;
  margin-bottom: 8px;
}

.btn-target {
  padding: 10px 18px;
  border: 1px solid rgba(148, 163, 184, 0.3);
  border-radius: 10px;
  background: rgba(51, 65, 85, 0.5);
  color: #e2e8f0;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 13px;
}

.btn-target:hover:not(:disabled) {
  border-color: #4ade80;
  background: rgba(74, 222, 128, 0.15);
}

.btn-target.selected {
  border-color: #4ade80;
  background: #4ade80;
  color: #0f172a;
  font-weight: 600;
}

.action-confirm {
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-top: 20px;
}

.btn-danger {
  background: linear-gradient(135deg, #ef4444, #dc2626);
  color: #fff;
  border: none;
  padding: 10px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-danger:hover {
  background: linear-gradient(135deg, #f87171, #ef4444);
  transform: translateY(-1px);
}

.btn-secondary {
  background: rgba(100, 116, 139, 0.5);
  color: #e2e8f0;
  border: 1px solid rgba(148, 163, 184, 0.3);
  padding: 10px 24px;
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(100, 116, 139, 0.7);
  color: #f8fafc;
}

.vote-done {
  text-align: center;
  padding: 24px;
}

.vote-message {
  font-size: 18px;
  font-weight: 600;
  color: #4ade80;
  margin-bottom: 12px;
}

.vote-target {
  font-size: 15px;
  color: #fca5a5;
}

.vote-target strong {
  color: #ef4444;
  font-size: 17px;
}
</style>
