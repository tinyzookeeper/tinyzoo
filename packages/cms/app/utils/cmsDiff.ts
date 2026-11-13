/**
 * Small helpers for showing what changed between two versions of a field.
 */

/** Plain text of a rich-text document (paragraphs on their own lines). */
export function richTextToPlain(doc: any): string {
  if (!doc || typeof doc !== 'object') return ''
  const blocks: string[] = []
  const walk = (node: any, out: string[]) => {
    if (!node) return
    if (node.type === 'text') out.push(node.text ?? '')
    else if (node.type === 'hardBreak') out.push('\n')
    else if (node.type === 'image') out.push('[image]')
    for (const child of node.content ?? []) walk(child, out)
  }
  for (const block of doc.content ?? []) {
    const out: string[] = []
    walk(block, out)
    blocks.push(out.join(''))
  }
  return blocks.join('\n').trim()
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
