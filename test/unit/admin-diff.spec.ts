import { describe, expect, it } from 'vitest'
import { richTextToPlain, wordDiff } from '../../packages/cms/app/utils/cmsDiff'

describe('admin diff helpers', () => {
  it('marks the words that changed between two texts', () => {
    const parts = wordDiff('Zahrada se otevírá v sobotu', 'Zahrada se otevírá v neděli')
    expect(parts.filter((p) => p.kind !== 'same').map((p) => [p.kind, p.text])).toEqual([['removed', 'sobotu'], ['added', 'neděli']])
    expect(parts.filter((p) => p.kind !== 'removed').map((p) => p.text).join('')).toBe('Zahrada se otevírá v neděli')
  })

  it('reads rich text as plain paragraphs', () => {
    expect(richTextToPlain({ type: 'doc', content: [
      { type: 'heading', content: [{ type: 'text', text: 'Nadpis' }] },
      { type: 'paragraph', content: [{ type: 'text', text: 'Text ' }, { type: 'text', text: 'tučně', marks: [{ type: 'bold' }] }] },
    ] })).toBe('Nadpis\nText tučně')
  })

  it('keeps list items on their own lines', () => {
    const item = (text: string, ...more: any[]) => ({ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }, ...more] })
    const text = richTextToPlain({ type: 'doc', content: [
      { type: 'paragraph', content: [{ type: 'text', text: 'Přineste:' }] },
      { type: 'bulletList', content: [item('chleba'), item('sůl', { type: 'bulletList', content: [item('hrubá')] })] },
      { type: 'orderedList', attrs: { start: 1 }, content: [item('upéct'), item('ochutnat')] },
      { type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Citace' }] }] },
    ] })
    expect(text).toBe('Přineste:\n• chleba\n• sůl\n  • hrubá\n1. upéct\n2. ochutnat\nCitace')
    // Two versions of a list differ item by item, not as one long word run.
    const parts = wordDiff('• chleba\n• sůl', '• chleba\n• sůl\n• máslo')
    expect(parts.filter((p) => p.kind === 'added').map((p) => p.text).join('')).toContain('máslo')
  })

  it('gives up on huge texts instead of stalling', () => {
    const a = Array.from({ length: 1000 }, (_, i) => `a${i}`).join(' ')
    const b = Array.from({ length: 1000 }, (_, i) => `b${i}`).join(' ')
    expect(wordDiff(a, b)).toEqual([{ text: a, kind: 'removed' }, { text: b, kind: 'added' }])
  })
})
