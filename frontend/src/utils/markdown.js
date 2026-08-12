/**
 * 轻量 Markdown → HTML 渲染器
 * 支持: 标题(# ~ ###), 加粗(**), 斜体(*), 列表(-), 换行, 段落
 */
export function renderMarkdown(text) {
  if (!text) return ''
  let html = text

  html = html.replace(/###\s+(.+)/g, '<h4>$1</h4>')
  html = html.replace(/##\s+(.+)/g, '<h3>$1</h3>')
  html = html.replace(/#\s+(.+)/g, '<h2>$1</h2>')

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')

  html = html.replace(/`(.+?)`/g, '<code>$1</code>')

  html = html.replace(/^\-\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')

  html = html.replace(/\n\n+/g, '</p><p>')
  html = html.replace(/\n/g, '<br>')

  html = '<p>' + html + '</p>'
  html = html.replace(/<p><\/p>/g, '')
  html = html.replace(/<p><(h[2-4]|ul|ol)/g, '<$1')
  html = html.replace(/<\/(h[2-4]|ul|ol)><\/p>/g, '</$1>')

  return html
}
