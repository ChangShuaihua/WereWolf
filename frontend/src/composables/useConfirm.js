import { ref, reactive } from 'vue'

const visible = ref(false)
const state = reactive({
  title: '提示',
  message: '',
  confirmText: '确定',
  cancelText: '取消',
  showCancel: true,
  type: 'info'
})

let pendingPromise = null
let pendingResolver = null

export function useConfirmDialog() {
  function showConfirm(options) {
    if (typeof options === 'string') {
      state.title = '提示'
      state.message = options
      state.confirmText = '确定'
      state.cancelText = '取消'
      state.showCancel = true
      state.type = 'info'
    } else if (options) {
      state.title = options.title || '提示'
      state.message = options.message || ''
      state.confirmText = options.confirmText || '确定'
      state.cancelText = options.cancelText || '取消'
      state.showCancel = options.showCancel !== false
      state.type = options.type || 'info'
    }

    visible.value = true

    return new Promise((resolve) => {
      pendingResolver = resolve
    })
  }

  function onConfirm() {
    visible.value = false
    if (pendingResolver) {
      const resolver = pendingResolver
      pendingResolver = null
      resolver(true)
    }
  }

  function onCancel() {
    visible.value = false
    if (pendingResolver) {
      const resolver = pendingResolver
      pendingResolver = null
      resolver(false)
    }
  }

  return {
    visible,
    state,
    showConfirm,
    onConfirm,
    onCancel
  }
}

export const confirmDialogState = { visible, state }
