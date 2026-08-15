import { ref } from 'vue'

// 模块级单例状态：跨组件共享，所有调用方操作同一份 toast 列表
const toasts = ref([])
let idCounter = 0

export function useToast() {
  function showToast(message, type = 'info', duration) {
    const id = ++idCounter
    toasts.value.push({ id, message, type })
    // 错误信息多停留一会儿；默认成功/提示 3s
    const d = duration ?? (type === 'error' ? 4500 : 3000)
    if (d > 0) {
      setTimeout(() => dismissToast(id), d)
    }
    return id
  }

  function dismissToast(id) {
    const idx = toasts.value.findIndex(t => t.id === id)
    if (idx !== -1) toasts.value.splice(idx, 1)
  }

  return { toasts, showToast, dismissToast }
}
