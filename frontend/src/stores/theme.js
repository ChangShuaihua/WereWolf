import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useThemeStore = defineStore('theme', () => {
  const theme = ref(localStorage.getItem('werewolf_theme') || 'light')

  const isDark = ref(theme.value === 'dark')

  function setTheme(newTheme) {
    theme.value = newTheme
    isDark.value = newTheme === 'dark'
    localStorage.setItem('werewolf_theme', newTheme)
    applyTheme()
  }

  function toggleTheme() {
    const newTheme = isDark.value ? 'light' : 'dark'
    setTheme(newTheme)
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', theme.value)
  }

  watch(theme, () => {
    isDark.value = theme.value === 'dark'
    localStorage.setItem('werewolf_theme', theme.value)
    applyTheme()
  })

  return { theme, isDark, setTheme, toggleTheme, applyTheme }
})
