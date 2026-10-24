export const USERNAME_REGEX = /^[a-zA-Z0-9_\u4e00-\u9fa5]{2,20}$/

export function validateUsername(username) {
  const value = typeof username === 'string' ? username.trim() : ''
  if (!value) return '用户名不能为空'
  if (!USERNAME_REGEX.test(value)) {
    return '用户名只能包含字母、数字、下划线或中文，长度2-20个字符'
  }
  return ''
}

export function validatePassword(password) {
  if (!password || typeof password !== 'string') return '密码不能为空'
  if (password.length < 6) return '密码长度不能少于6位'
  if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    return '密码必须包含字母和数字'
  }
  return ''
}
