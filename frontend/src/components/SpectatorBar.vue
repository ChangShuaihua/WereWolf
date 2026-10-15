<template>
  <div class="spectator-bar">
    <span class="spectator-label">观众席</span>
    <select class="spectator-select" :value="''" aria-label="观众席">
      <option value="">
        {{ spectators.length ? `观众 ${spectators.length} 人` : '暂无观众' }}
      </option>
      <option
        v-for="spectator in spectators"
        :key="spectator.userId || spectator.socketId"
        :value="spectator.userId || spectator.socketId"
        disabled
      >
        {{ spectator.username }}
      </option>
    </select>
    <span v-if="watching" class="spectator-badge">观战中</span>
  </div>
</template>

<script setup>
defineProps({
  spectators: { type: Array, default: () => [] },
  watching: { type: Boolean, default: false },
})
</script>

<style scoped>
.spectator-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex-shrink: 0;
  margin-bottom: 12px;
}

.spectator-label {
  flex-shrink: 0;
  font-size: 0.82rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  color: var(--text-secondary);
}

.spectator-select {
  min-width: 148px;
  max-width: 240px;
  height: 34px;
  padding: 0 10px;
  border-radius: var(--radius-md);
  border: var(--border-thin);
  background: var(--bg-secondary);
  color: var(--text-primary);
  font-family: var(--font-sans);
  font-size: 0.84rem;
}

.spectator-badge {
  flex-shrink: 0;
  padding: 4px 8px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.14);
  color: #7dd3fc;
  font-size: 0.75rem;
  font-weight: 700;
}
</style>
