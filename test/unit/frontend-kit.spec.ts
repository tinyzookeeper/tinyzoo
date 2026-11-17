import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { repoRoot } from '../helpers/apiReport'
import { composableApi, componentApi, frontendKitReport, KIT_COMPONENTS, KIT_COMPOSABLES } from '../helpers/frontendKit'
import { goldenTests } from '../helpers/golden'

// The frontend kit (<CmsBlocks>, <CmsImage>, <CmsContent>, <CmsNav>, <CmsHighlight>, <CmsForm>,
// useCmsSeo, useCmsSearch, useCmsUiLocale) is frozen from 1.0 like the config API: `frontend-kit.txt`
// holds each one's props, emits, slots and signature, so a change to what a website can pass or
// receive fails here until it is accepted with `pnpm contracts:update` (and the changeset says
// whether it breaks sites). The prop types themselves are also part of `api-tinyzoo.txt`.

goldenTests('the frontend kit (test/contracts)', [
  { file: 'frontend-kit.txt', what: 'the props, emits, slots and signatures of the frontend kit', render: frontendKitReport },
], 'The frontend kit changed')

describe('the frontend kit', () => {
  it('declares every component\'s props with a type of src/frontend.ts, so the type is the API', () => {
    for (const c of KIT_COMPONENTS.filter((k) => k.tag !== 'CmsContent')) {
      const api = componentApi(c.file)
      expect(api.propsType, `${c.tag} declares its props inline: use an interface of packages/cms/src/frontend.ts`).not.toBeNull()
    }
    // CmsContent is a render function: its `props:` option is typed from the same interface.
    expect(componentApi('app/components/CmsContent.vue').propsText).toContain('CmsContentProps')
  })

  it('reads what a component declares', () => {
    expect(componentApi('forms/components/CmsForm.vue')).toMatchObject({ propsType: 'CmsFormProps', emits: ['sent: []'], slots: ['success'] })
    expect(componentApi('app/components/CmsBlocks.vue')).toMatchObject({ propsType: 'CmsBlocksProps', defaults: "{ prefix: 'Block' }", slots: [] })
  })

  it('reads the signature and the return value of a composable', () => {
    expect(composableApi('useCmsSearch', 'app/composables/useCmsSearch.ts').returns).toEqual(['items', 'total', 'searched', 'pending', 'error'])
    expect(composableApi('useCmsSeo', 'app/composables/useCmsSeo.ts').returns).toEqual(['title', 'description', 'image', 'canonical'])
    expect(composableApi('useCmsSeo', 'app/composables/useCmsSeo.ts').signature).toContain('function useCmsSeo(item: MaybeRefOrGetter<')
  })

  it('is named, with its props and slots, on docs/api-surface.md', () => {
    const doc = readFileSync(join(repoRoot, 'docs/api-surface.md'), 'utf8')
    const missing = [...KIT_COMPONENTS.map((c) => `<${c.tag}`), ...KIT_COMPOSABLES.map((c) => `${c.name}(`)].filter((x) => !doc.includes(x))
    expect(missing).toEqual([])
  })
})
