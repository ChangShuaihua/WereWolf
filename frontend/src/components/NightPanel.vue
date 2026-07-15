<template>
  <div class="night-panel">
    <div v-if="!prompt" class="night-waiting">
      <p>🌙 夜晚阶段 - 等待你的行动提示...</p>
    </div>

    <div v-else-if="seerResult" class="action-done">
      <p>🔮 查验结果：{{ seerResult.message }}</p>
    </div>

    <div v-else class="night-actions">
      <p class="action-message">{{ prompt.message }}</p>

      <!-- Witch special: show killed info + save/poison options with toggle -->
      <div v-if="prompt.action === 'witch'" class="witch-options">
        <div class="witch-mode-toggle">
          <button
            class="btn btn-mode"
            :class="{ active: witchMode === 'save' }"
            :disabled="!prompt.canSave"
            @click="witchMode = 'save'"
          >
            💚 解药模式
          </button>
          <button
            class="btn btn-mode"
            :class="{ active: witchMode === 'poison' }"
            :disabled="!prompt.canPoison"
            @click="witchMode = 'poison'"
          >
            💀 毒药模式
          </button>
        </div>

        <div v-if="witchMode === 'save' && prompt.canSave" class="save-option">
          <p v-if="prompt.killed">
            今晚 <strong>{{ prompt.killed.username }}</strong> 被杀，是否使用解药？
          </p>
          <button class="btn btn-warn" @click="$emit('action', { action: 'save' })">💚 使用解药</button>
          <button class="btn btn-secondary" @click="$emit('action', { action: 'skip' })">跳过</button>
        </div>

        <div v-if="witchMode === 'poison' && prompt.canPoison" class="poison-option">
          <p>选择下毒目标：</p>
          <div class="target-grid">
            <button
              v-for="t in prompt.targets"
              :key="t.id"
              class="btn btn-target"
              :class="{ selected: selectedTarget === t.id }"
              @click="selectTarget(t.id)"
            >
              {{ t.username }}
            </button>
          </div>
          <div v-if="selectedTarget" class="action-confirm">
            <button class="btn btn-danger" @click="confirmAction">💀 确认下毒</button>
            <button class="btn btn-secondary" @click="selectedTarget = null">取消</button>
          </div>
        </div>
      </div>

      <!-- Other roles: simple target selection with highlight -->
      <div v-else class="target-grid">
        <button
          v-for="t in prompt.targets"
          :key="t.id"
          class="btn btn-target"
          :class="{ selected: selectedTarget === t.id }"
          @click="selectTarget(t.id)"
        >
          {{ t.username }}
        </button>
        <div v-if="selectedTarget" class="action-confirm">
          <button class="btn btn-primary" @click="confirmAction">确认选择</button>
          <button class="btn btn-secondary" @click="selectedTarget = null">取消</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  prompt: { type: Object, default: null },
  seerResult: { type: Object, default: null },
})

const emit = defineEmits(['action'])

const witchMode = ref('save')
const selectedTarget = ref(null)

function selectTarget(targetId) {
  selectedTarget.value = selectedTarget.value === targetId ? null : targetId
}

function confirmAction() {
  if (props.prompt.action === 'witch' && witchMode.value === 'poison') {
    emit('action', { action: 'poison', targetId: selectedTarget.value })
  } else {
    emit('action', { targetId: selectedTarget.value })
  }
  selectedTarget.value = null
}
</script>
