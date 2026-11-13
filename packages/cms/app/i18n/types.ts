import type en from './en'

/** A plural message: Intl.PluralRules categories, `other` required. */
export type PluralMessage = { zero?: string; one?: string; two?: string; few?: string; many?: string; other: string }

type IsPlural<T> = T extends { other: string } ? true : false

/** The shape every locale must match: same keys as en.ts, any string values. */
export type AdminMessages = {
  [K in keyof typeof en]: Shape<(typeof en)[K]>
}
type Shape<T> = T extends string ? string
  : IsPlural<T> extends true ? PluralMessage
  : { [K in keyof T]: Shape<T[K]> }

/** Dot paths to every message, e.g. 'list.emptyTitle' | 'common.items'. */
export type MessageKey = Paths<typeof en>
type Paths<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}`
    : IsPlural<T[K]> extends true ? `${P}${K}`
    : Paths<T[K], `${P}${K}.`>
}[keyof T & string]
