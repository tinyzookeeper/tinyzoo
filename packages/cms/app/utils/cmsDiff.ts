/**
 * Small helpers for showing what changed between two versions of a field.
 */

/**
 * Plain text of a rich-text document, one line per paragraph, heading or list item
 * (bullets and numbers kept, nested items indented), so a list reads as a list and
 * its items never run together when two versions are compared.
 */
export function richTextToPlain(doc: any): string {
  if (!doc || typeof doc !== 'object') return ''
  const inline = (node: any): string => {
    if (!node) return ''
    if (node.type === 'text') return node.text ?? ''
    if (node.type === 'hardBreak') return '\n'
    if (node.type === 'image') return '[image]'
    return (node.content ?? []).map(inline).join('')
  }
  const lines: string[] = []
  const block = (node: any, indent: string, first: string) => {
    if (!node) return
    if (node.type === 'bulletList' || node.type === 'orderedList') {
      ;(node.content ?? []).forEach((item: any, i: number) => {
        const bullet = node.type === 'orderedList' ? `${(Number(node.attrs?.start) || 1) + i}. ` : '• '
        listItem(item, indent, bullet)
      })
    }
    else if (node.type === 'blockquote') {
      for (const child of node.content ?? []) block(child, indent, indent)
    }
    else lines.push(first + inline(node))
  }
  const listItem = (item: any, indent: string, bullet: string) => {
    const pad = indent + ' '.repeat(bullet.length)
    let used = false
    for (const child of item?.content ?? []) {
      if (child?.type === 'bulletList' || child?.type === 'orderedList') block(child, pad, pad)
      else {
        block(child, pad, used ? pad : indent + bullet)
        used = true
      }
    }
    if (!used) lines.push(indent + bullet.trimEnd())
  }
  for (const node of doc.content ?? []) block(node, '', '')
  return lines.join('\n').trim()
}

export interface DiffPart { text: string; kind: 'same' | 'added' | 'removed' }

/**
 * Word-level difference from `a` to `b` (longest common subsequence). Long texts
 * fall back to "all removed, all added" rather than stalling the page.
 */
export function wordDiff(a: string, b: string): DiffPart[] {
  const x = a.split(/(\s+)/).filter(Boolean)
  const y = b.split(/(\s+)/).filter(Boolean)
  if (x.length * y.length > 400_000) {
    return [...(a ? [{ text: a, kind: 'removed' as const }] : []), ...(b ? [{ text: b, kind: 'added' as const }] : [])]
  }
  const n = x.length
  const m = y.length
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) lcs[i]![j] = x[i] === y[j] ? lcs[i + 1]![j + 1]! + 1 : Math.max(lcs[i + 1]![j]!, lcs[i]![j + 1]!)
  }
  const out: DiffPart[] = []
  const push = (text: string, kind: DiffPart['kind']) => {
    const last = out[out.length - 1]
    if (last && last.kind === kind) last.text += text
    else out.push({ text, kind })
  }
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (x[i] === y[j]) { push(x[i]!, 'same'); i++; j++ }
    else if (lcs[i + 1]![j]! >= lcs[i]![j + 1]!) push(x[i++]!, 'removed')
    else push(y[j++]!, 'added')
  }
  while (i < n) push(x[i++]!, 'removed')
  while (j < m) push(y[j++]!, 'added')
  return out
}
