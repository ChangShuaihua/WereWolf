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
