// How a list with a card of its own (BlockSectionList, KitCard*) is drawn: read from the components' source,
// as the layout section's drawing is in template-kit-sections.spec.ts. What is drawn from what is in template-kit-card.spec.ts.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const repoRoot = join(__dirname, '..', '..')
const kit = (file: string) => readFileSync(join(repoRoot, 'templates', 'kit', 'app', 'components', file), 'utf8')
const CARD_BLOCKS = ['KitCardHeading', 'KitCardText', 'KitCardPicture', 'KitCardButton', 'KitCardGroup']

describe('card list: how it is drawn', () => {
  it('draws each card, and a group its own list, with <CmsBlocks prefix="KitCard">', () => {
    expect(kit('BlockSectionList.vue')).toContain('<CmsBlocks :blocks="card.items" prefix="KitCard" />')
    expect(kit('KitCardGroup.vue')).toContain('<CmsBlocks :blocks="block.items" prefix="KitCard" />')
  })

  it('gives each small block one root element, and never an h1', () => {
    for (const name of CARD_BLOCKS) {
      const template = kit(`${name}.vue`).split('<template>')[1]!.split('</template>').slice(0, -1).join('</template>')
      const roots = template.split('\n').filter((l) => /^ {2}<[a-zA-Z]/.test(l) && !/\sv-else[\s>]/.test(l))
      expect(roots, name).toHaveLength(1)
      expect(template, name).not.toMatch(/h1/)
    }
  })

  it('writes every rule of its stylesheet from the section\'s root class, with no width query', () => {
    const style = kit('BlockSectionList.vue').split('<style>')[1]!.split('</style>')[0]!
    expect(style).not.toMatch(/@media/)
    // A @container block wraps its rules: look at the rules inside it, not at the at-rule.
    const css = style.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@container[^{]*\{/g, '')
    const selectors = css.split('}').map((r) => r.split('{')[0]!.trim()).filter(Boolean).flatMap((s) => s.split(',').map((x) => x.trim()))
    expect(selectors.length).toBeGreaterThan(30)
    for (const s of selectors) {
      // (the section's root is .kit-section.kit-card-section: a rule may name both)
      expect(s, s).toMatch(/^\.kit-section[ .]/)
      expect((s.match(/\.[a-z][a-z0-9-]*/g) ?? []).length, s).toBeGreaterThanOrEqual(3)
    }
    expect(style).not.toMatch(/border-left|border-inline-start/)
  })

  it('registers the section and the five small blocks globally', () => {
    const module = readFileSync(join(repoRoot, 'templates', 'kit', 'module.ts'), 'utf8')
    expect(module).toMatch(/const KIT_BLOCKS = \[[^\]]*'BlockSectionList'/)
    const cards = module.match(/const KIT_CARD_BLOCKS = \[([^\]]*)\]/)?.[1] ?? ''
    for (const name of CARD_BLOCKS) expect(cards, name).toContain(`'${name}'`)
    expect(module).toMatch(/\.\.\.KIT_CARD_BLOCKS\][\s\S]{0,200}global: true/)
  })

  it('writes the data-kit-card marks only while editing', () => {
    const source = kit('BlockSectionList.vue').split('</script>')[1]!.split('<style>')[0]!
    for (const attr of ['data-kit-card', 'data-kit-card-collection', 'data-kit-card-entry', 'data-kit-card-sample', 'data-kit-card-empty']) {
      const line = source.split('\n').find((l) => l.includes(`:${attr}="`))
      expect(line, attr).toBeDefined()
      expect(line, attr).toContain('editing')
    }
    // The placeholders' notes too.
    for (const l of source.split('\n').filter((l) => l.includes('kit-card-note'))) expect(l).toContain('editing')
  })

  it('keeps the section button a link for a link, and a span only for an empty one', () => {
    const button = kit('KitSectionButton.vue')
    expect(button).toContain('<NuxtLink v-else :to="to" class="kit-btn"')
    expect(button).toContain('<span v-if="to === \'\'"')
  })
})
