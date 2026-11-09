<template>
  <div class="avatar-library" role="radiogroup" aria-label="头像库">
    <button
      v-for="avatar in avatarCatalog"
      :key="avatar.id"
      type="button"
      class="avatar-library-option"
      :class="{ selected: modelValue === avatar.src }"
      role="radio"
      :aria-checked="modelValue === avatar.src"
      :title="avatar.name"
      @click="$emit('update:modelValue', avatar.src)"
    >
      <img :src="avatar.src" :alt="avatar.name" />
      <span>{{ avatar.name }}</span>
    </button>
  </div>
</template>

<script setup>
import { avatarCatalog } from '../utils/avatarCatalog'

defineProps({ modelValue: { type: String, default: '' } })
defineEmits(['update:modelValue'])
</script>

<style scoped>
.avatar-library { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 10px; }
.avatar-library-option { position: relative; display: grid; justify-items: center; gap: 5px; padding: 7px 5px 6px; color: var(--text-secondary); background: rgba(10, 14, 24, .62); border: 1px solid rgba(231, 194, 122, .18); border-radius: 14px; cursor: pointer; transition: transform .18s ease, border-color .18s ease, background .18s ease; }
.avatar-library-option img { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
.avatar-library-option span { max-width: 100%; font-size: .72rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.avatar-library-option:hover { transform: translateY(-2px); border-color: rgba(231, 194, 122, .55); background: rgba(231, 194, 122, .08); }
.avatar-library-option.selected { border-color: #e7c27a; background: rgba(198, 161, 94, .16); box-shadow: 0 0 0 2px rgba(198, 161, 94, .14), inset 0 0 20px rgba(198, 161, 94, .08); color: var(--text-primary); }
.avatar-library-option:focus-visible { outline: 2px solid #e7c27a; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) { .avatar-library-option { transition: none; } }
</style>
