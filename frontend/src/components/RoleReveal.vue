<template>
  <div class="overlay">
    <div class="role-reveal-card">
      <div class="role-icon">{{ roleIcon }}</div>
      <h2>你的身份是</h2>
      <h1>{{ roleName }}</h1>
      <p class="role-desc">{{ roleDesc }}</p>
      <button class="btn btn-primary" @click="$emit('close')">知道了</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  role: String,
  roleName: String,
})

defineEmits(['close'])

const roleIcons = {
  werewolf: '🐺',
  villager: '👨‍🌾',
  seer: '🔮',
  witch: '🧪',
  hunter: '🏹',
  guard: '🛡️',
}

const roleDescs = {
  werewolf: '每晚可以选择击杀一名玩家，白天伪装成村民',
  villager: '没有特殊能力，通过推理找出狼人',
  seer: '每晚可以查验一名玩家的身份',
  witch: '拥有一瓶解药和一瓶毒药，各限用一次',
  hunter: '被淘汰时可以开枪带走一名玩家',
  guard: '每晚可以守护一名玩家，不能连续守护同一人',
}

const roleIcon = computed(() => roleIcons[props.role] || '❓')
const roleDesc = computed(() => roleDescs[props.role] || '')
</script>
