export const USAGE: string

export interface Prompts {
  intro(title: string): void
  outro(message: string): void
  cancel(message: string): void
  isCancel(value: unknown): boolean
  text(options: { message: string; placeholder?: string; defaultValue?: string; initialValue?: string; validate?: (value: string | undefined) => string | undefined }): Promise<string | symbol>
  select(options: { message: string; options: { value: string; label: string }[]; initialValue?: string }): Promise<string | symbol>
  multiselect(options: { message: string; options: { value: string; label: string; hint?: string }[]; initialValues?: string[]; required?: boolean }): Promise<string[] | symbol>
  confirm(options: { message: string; initialValue?: boolean }): Promise<boolean | symbol>
  log: { info(message: string): void; step(message: string): void; warn(message: string): void }
}

export interface Template {
  init: typeof import('../../cms/cli/init.mjs')
  starterDir: string
  version: string
}

export function loadTemplate(): Promise<Template>

export interface Dependencies {
  ui?: Prompts
  interactive?: boolean
  cwd?: string
  env?: Record<string, string | undefined>
  log?: (message: string) => void
  error?: (message: string) => void
  loadTemplate?: () => Promise<Template>
  run?: (command: string, args: string[], cwd: string) => Promise<boolean>
}

export function main(argv: string[], deps?: Dependencies): Promise<number>
