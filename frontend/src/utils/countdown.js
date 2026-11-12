export function countdownPercent(remaining, timeout) {
  const total = Number(timeout)
  if (!Number.isFinite(total) || total <= 0) return 0

  const current = Number(remaining)
  if (!Number.isFinite(current)) return 0

  return Math.min(100, Math.max(0, (current / total) * 100))
}

export function countdownUrgency(percent) {
  const value = Number(percent)
  if (!Number.isFinite(value) || value < 25) return 'danger'
  if (value < 50) return 'warning'
  return 'safe'
}
