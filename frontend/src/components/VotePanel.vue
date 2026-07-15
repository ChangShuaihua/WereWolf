<template>
  <div class="vote-panel">
    <p class="vote-title">🗳️ 请选择要放逐的玩家 ({{ votedCount }}/{{ totalVoters }})</p>

    <div v-if="candidates.length > 0" class="target-grid">
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

    <div v-if="selectedCandidate" class="action-confirm">
      <button class="btn btn-danger" @click="confirmVote">🗳️ 确认投票</button>
      <button class="btn btn-secondary" @click="selectedCandidate = null">取消</button>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  candidates: { type: Array, default: () => [] },
  votedCount: { type: Number, default: 0 },
  totalVoters: { type: Number, default: 0 },
})

const emit = defineEmits(['vote'])

const selectedCandidate = ref(null)

function selectCandidate(id) {
  selectedCandidate.value = selectedCandidate.value === id ? null : id
}

function confirmVote() {
  emit('vote', selectedCandidate.value)
  selectedCandidate.value = null
}
</script>
