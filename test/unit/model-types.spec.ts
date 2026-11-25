import { describe, expect, it } from 'vitest'
import { defineEntity, f, eq } from '../../packages/cms/src/index'
import { modelEntities } from '../../packages/cms/src/model-map'
import { emitContentTypes } from '../../packages/cms/src/sdk'
import { buildOpenApiDocument } from '../../packages/cms/src/openapi'
import type { ModelDoc, ModelType } from '../../packages/cms/src/model-doc'
import { customModelConfig, modelFileDoc, modelFileOf, parseModelFile, writeModelFile } from '../../packages/cms/src/model-file'

// A select of a site's own content type is open in the generated types and in OpenAPI: the owner
// can add a choice at any time. The same types written in code give the same output.

const category = () => defineEntity('category', {
  label: 'Categories',
  titleField: 'name',
  fields: {
    name: f.text({ required: true }),
    kind: f.select({ options: ['a', 'b'] as const, default: 'a' }),
  },
  content: { public: true },
})
const design = () => ({ category: category() })

const courseDoc: ModelType = {
  name: 'custom_course',
  label: { en: 'Courses' },
  titleField: 'title',
  page: { prefix: 'kurzy' },
  publish: true,
  fields: [
    { key: 'title', type: 'text', label: { en: 'Title' }, required: true },
    {
      key: 'level',
      type: 'select',
      required: true,
      default: 'beginner',
      label: { en: 'Level' },
      options: [
        { value: 'beginner', label: { en: 'Beginners' } },
        { value: 'advanced', label: { en: 'Advanced' } },
      ],
    },
    { key: 'teacher', type: 'relation', to: 'custom_teacher', label: { en: 'Teacher' } },
  ],
}
const teacherDoc: ModelType = {
  name: 'custom_teacher',
  label: { en: 'Teachers' },
  titleField: 'title',
  listColumns: null,
  fields: [
    { key: 'title', type: 'text', label: { en: 'Title' }, required: true },
    {
      key: 'rank',
      type: 'select',
      label: { en: 'Rank' },
      options: [
        { value: 'junior', label: { en: 'Junior' } },
        { value: 'senior', label: { en: 'Senior' } },
      ],
    },
  ],
}

function byHand() {
  const course: any = defineEntity('custom_course', {
    label: { en: 'Courses' },
    titleField: 'title',
    fields: {
      title: f.text({ required: true }).label({ en: 'Title' }),
      level: f.select({
        options: ['beginner', 'advanced'] as const,
        default: 'beginner',
        labels: { beginner: { en: 'Beginners' }, advanced: { en: 'Advanced' } },
      }).label({ en: 'Level' }),
      teacher: f.relation({ to: () => teacher, kind: 'many-to-one' }).label({ en: 'Teacher' }),
      slug: f.slug({ from: 'title', unique: true }).label({ en: 'URL address', cs: 'Adresa (URL)', de: 'Adresse (URL)' }),
      status: f.select({
        options: ['draft', 'published'] as const,
        default: 'draft',
        labels: { draft: { en: 'Draft', cs: 'Koncept', de: 'Entwurf' }, published: { en: 'Published', cs: 'Zveřejněno', de: 'Veröffentlicht' } },
      }).label({ en: 'Status', cs: 'Stav', de: 'Status' }),
    },
    content: { public: true, slug: 'slug', path: '/kurzy/:slug', published: (t: any) => eq(t.status, 'published') },
    publish: { field: 'status', publishedValue: 'published', draftValue: 'draft', preview: '/kurzy/:slug' },
  } as any)
  const teacher: any = defineEntity('custom_teacher', {
    label: { en: 'Teachers' },
    titleField: 'title',
    fields: {
      title: f.text({ required: true }).label({ en: 'Title' }),
      rank: f.select({
        options: ['junior', 'senior'] as const,
        labels: { junior: { en: 'Junior' }, senior: { en: 'Senior' } },
      }).optional().label({ en: 'Rank' }),
    },
    content: { public: true },
  } as any)
  return { custom_course: course, custom_teacher: teacher }
}

const section = (text: string, start: string) => {
  const from = text.indexOf(start)
  expect(from).toBeGreaterThan(-1)
  return text.slice(from, text.indexOf('\n}', from) + 2)
}

describe('the types of a custom type', () => {
  const base = design()
  const { entities, problems } = modelEntities({ format: 1, types: [courseDoc, teacherDoc] } as ModelDoc, base)
  const fromDoc = { ...base, ...entities }
  const fromCode = { ...design(), ...byHand() }
  const ts = emitContentTypes(fromDoc)
  const api = buildOpenApiDocument(fromDoc) as any

  it('builds the document without a problem', () => {
    expect(problems).toEqual([])
  })

  it('gives the same TypeScript as the same types written in code', () => {
    expect(ts).toBe(emitContentTypes(fromCode))
  })

  it('gives the same OpenAPI document as the same types written in code', () => {
    expect(JSON.stringify(api)).toBe(JSON.stringify(buildOpenApiDocument(fromCode)))
  })

  it('gives the same types through a model file, with a removed type and field left out', () => {
    const removedAt = '2026-11-25T10:00:00.000Z'
    const withRemoved: ModelDoc = {
      format: 1,
      types: [
        { ...courseDoc, fields: [...courseDoc.fields, { key: 'old', type: 'text', label: { en: 'Old' }, removedAt }] },
        teacherDoc,
        { name: 'custom_gone', label: { en: 'Gone' }, titleField: 'title', removedAt, fields: [{ key: 'title', type: 'text', label: { en: 'Title' }, required: true }] },
      ],
    }
    const file = parseModelFile(JSON.parse(writeModelFile(modelFileOf(withRemoved, { version: 3 }))))
    const { config, problems: left } = customModelConfig(design(), modelFileDoc(file))
    expect(left).toEqual([])
    expect(emitContentTypes(config)).toBe(emitContentTypes(fromCode))
    expect(JSON.stringify(buildOpenApiDocument(config))).toBe(JSON.stringify(buildOpenApiDocument(fromCode)))
  })

  it('types a select open in the item, and the mapper status closed', () => {
    const item = section(ts, 'export interface CustomCourse {')
    expect(item).toContain("level: 'beginner' | 'advanced' | (string & {})\n")
    expect(item).toContain("status: 'draft' | 'published'\n")
  })

  it('types an optional select open and nullable, in the embedded interface too', () => {
    expect(section(ts, 'export interface CustomTeacherEmbedded {')).toContain("rank: 'junior' | 'senior' | (string & {}) | null")
    expect(section(ts, 'export interface CustomTeacher {')).toContain("rank: 'junior' | 'senior' | (string & {}) | null")
  })

  it('types the filters open, and the status filter closed', () => {
    const filters = section(ts, 'export interface CustomCourseFilters {')
    expect(filters).toContain("level?: 'beginner' | 'advanced' | (string & {})")
    expect(filters).toContain("status?: 'draft' | 'published'\n")
    expect(section(ts, 'export interface CustomTeacherFilters {')).toContain("rank?: 'junior' | 'senior' | (string & {})")
  })

  it('keeps a select of a code-first type closed', () => {
    expect(section(ts, 'export interface Category {')).toContain("kind: 'a' | 'b'\n")
    expect(section(ts, 'export interface CategoryFilters {')).toContain("kind?: 'a' | 'b'\n")
  })

  it('has an open select in OpenAPI without enum, with the known values as examples', () => {
    const course = api.components.schemas.CustomCourse.properties
    expect(course.level.enum).toBeUndefined()
    expect(course.level).toEqual({ type: 'string', examples: ['beginner', 'advanced'] })
    expect(course.status.enum).toEqual(['draft', 'published'])
    const rank = api.components.schemas.CustomTeacher.properties.rank
    expect(rank).toEqual({ type: ['string', 'null'], examples: ['junior', 'senior'] })
  })

  it('has the filter parameter open in OpenAPI, and status closed', () => {
    const params = api.paths['/api/content/custom_course'].get.parameters
    const schemaOf = (name: string) => params.find((p: any) => p.name === name).schema
    expect(schemaOf('level')).toEqual({ type: 'string', examples: ['beginner', 'advanced'] })
    expect(schemaOf('status')).toEqual({ type: 'string', enum: ['draft', 'published'] })
  })

  it('leaves a code-first select closed in OpenAPI', () => {
    expect(api.components.schemas.Category.properties.kind.enum).toEqual(['a', 'b'])
  })
})

describe('a site without custom types', () => {
  it('has no open type', () => {
    const ts = emitContentTypes(design())
    expect(ts).not.toContain('(string & {})')
    expect(JSON.stringify(buildOpenApiDocument(design()))).not.toContain('"examples"')
  })
})
