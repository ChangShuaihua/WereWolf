export const avatarCatalog = [
  ['raven', '渡鸦', '#394867', '#d8b08c', '#1b2236'],
  ['ember', '余烬', '#8f3f3f', '#c98f72', '#371f2b'],
  ['sage', '青岚', '#39706a', '#e0b997', '#273b39'],
  ['luna', '月白', '#78659b', '#f0c9aa', '#302a4b'],
  ['rook', '城垒', '#4e5968', '#9f6e55', '#202733'],
  ['iris', '鸢尾', '#6f507a', '#b87962', '#302033'],
  ['ash', '灰烬', '#59636f', '#e2bda1', '#2b3038'],
  ['moss', '苔痕', '#55704c', '#a87557', '#293425'],
  ['nova', '新星', '#3f668b', '#d09a79', '#1f3047'],
  ['silk', '银丝', '#8a7891', '#edc5a5', '#3b3143'],
  ['flint', '燧石', '#76543b', '#8f5e45', '#30251d'],
  ['tide', '潮汐', '#386d82', '#d6a182', '#1d3540'],
].map(([id, name, accent, skin, hair]) => ({
  id,
  name,
  src: `/avatars/${id}.svg`,
  accent,
  skin,
  hair,
}))

export const defaultAvatar = avatarCatalog[0].src

export function isImageAvatar(value) {
  return typeof value === 'string' && (value.startsWith('/avatars/') || value.startsWith('/api/avatars/'))
}

export function resolveAgentAvatar(value, seed = '') {
  if (isImageAvatar(value)) return value
  const text = `${seed}:${value || ''}`
  let hash = 0
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 31) + text.charCodeAt(i)) >>> 0
  return avatarCatalog[hash % avatarCatalog.length].src
}
