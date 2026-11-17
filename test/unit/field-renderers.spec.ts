import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// A custom field renderer is told when the field is read-only (`CmsFieldEditProps.readOnly`). The admin's components are
// not mounted in the unit tests (no browser here), so this reads their source: the dispatcher passes the prop to
// every renderer it renders, and every built-in editor declares it (an undeclared prop would land on its root as an attribute).

const components = join(import.meta.dirname, '../../packages/cms/app/components')
const source = (name: string) => readFileSync(join(components, name), 'utf8')

describe('read-only fields and their renderers', () => {
  it('CmsField gives every renderer it renders the readOnly prop (from the field or from the form)', () => {
    const text = source('CmsField.vue')
    const rendered = text.match(/<component\s[^>]*?:is="component"[^>]*?>/gs) ?? []
    expect(rendered.length).toBe(3) // a switch, a details row, the usual layout
    for (const tag of rendered) expect(tag).toContain(':read-only="readOnlyProp"')
    // the value: the field's own lock or the form's, and `undefined` when not, so no attribute lands on a renderer that has no such prop
    expect(text).toMatch(/const readOnly = computed\(\(\) => !!formReadOnly\?\.value \|\| !!props\.field\.readOnly\)/)
    expect(text).toMatch(/const readOnlyProp = computed\(\(\) => readOnly\.value \|\| undefined\)/)
  })

  it('every built-in editor declares the prop', () => {
    const editors = readdirSync(components).filter((f) => /^CmsField[A-Z]\w+\.vue$/.test(f) && f !== 'CmsFieldLock.vue')
    expect(editors.length).toBeGreaterThanOrEqual(14)
    for (const file of editors) expect(source(file), file).toMatch(/defineProps<\{[^}]*\breadOnly\?: boolean[^}]*\}>\(\)/)
  })

  it('the gallery and the blocks field, whose drag handles a fieldset cannot disable, do not drag when read-only', () => {
    expect(source('CmsFieldGallery.vue')).toContain(':draggable="!readOnly"')
    expect(source('CmsFieldGallery.vue')).toMatch(/if \(props\.readOnly \|\| from === null/)
    expect(source('CmsFieldBlocks.vue')).toContain(':draggable="!readOnly && armed === b.id"')
    expect(source('CmsFieldBlocks.vue')).toMatch(/if \(props\.readOnly \|\| from === null/)
  })
})
