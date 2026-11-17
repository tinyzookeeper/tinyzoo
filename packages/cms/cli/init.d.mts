export class InitError extends Error {}

export interface Preset { name: string; label: string; hint: string }
export const PRESETS: Preset[]
export const PRESET_NAMES: string[]
export const DEFAULT_LANGUAGES: string[]
export const DEMO_LANGUAGES: string[]
export const COMMON_LANGUAGES: string[]
export const PACKAGE_MANAGERS: string[]
export const ADDRESS_WORDS: Record<string, { news: string; search: string }>
export const INIT_USAGE: string

export function detectPackageManager(userAgent?: string): string
export function parseLanguages(text: string): string[]
export function parsePresets(text: string): string[]

export interface InitArgs {
  folder: string | undefined
  languages: string[] | undefined
  presets: string[] | undefined
  demo: boolean | undefined
  yes: boolean
  help: boolean
  install: boolean | undefined
  packageManager: string | undefined
}
export function parseInitArgs(argv: string[], options?: { install?: boolean }): InitArgs

export interface InitChoices { languages: string[]; presets: string[]; demo: boolean }
export function resolveOptions(given?: { languages?: string[]; presets?: string[]; demo?: boolean }): InitChoices

export function applyMarkers(text: string, on: Set<string>, where?: string): string
export function packageNameOf(folder: string): string
export function commandsFor(text: string, pm: string): string
export function runScript(pm: string, script: string): string

export interface ScaffoldOptions extends InitChoices {
  dest: string
  starterDir: string
  version: string
  packageManager?: string
}
export interface ScaffoldResult {
  dest: string
  /** What the site must generate before it starts: the database schema and migration, the typed client. */
  regenerate: { schema: boolean; client: boolean }
}
export function scaffold(options: ScaffoldOptions): ScaffoldResult

export function nextSteps(options: {
  folder: string
  packageManager: string
  demo: boolean
  regenerate: { schema: boolean; client: boolean }
  installed?: boolean
  generated?: boolean
}): string
