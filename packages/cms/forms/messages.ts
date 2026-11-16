// What a visitor is told when a website form is refused, in their language. Pure functions
// (no server context): the POST route turns the validation issues of a submission into
// these, so the form shows "Vyberte jednu z možností." and not a validator's English.

type Messages = {
  required: string
  invalid: string
  email: string
  url: string
  choose: string
  number: string
  tooLong: (max: number) => string
  tooShort: (min: number) => string
  tooSmall: (min: number) => string
  tooBig: (max: number) => string
  tick: string
}

const MESSAGES: Record<string, Messages> = {
  cs: {
    required: 'Vyplňte prosím.',
    invalid: 'Zkontrolujte prosím tuto hodnotu.',
    email: 'Zadejte prosím platný e-mail.',
    url: 'Zadejte prosím platnou adresu (https://…).',
    choose: 'Vyberte jednu z možností.',
    number: 'Zadejte prosím číslo.',
    tooLong: (max) => `Text je příliš dlouhý (nejvýše ${max} znaků).`,
    tooShort: (min) => `Text je příliš krátký (alespoň ${min} znaků).`,
    tooSmall: (min) => `Číslo musí být alespoň ${min}.`,
    tooBig: (max) => `Číslo musí být nejvýše ${max}.`,
    tick: 'Pro odeslání je potřeba toto políčko zaškrtnout.',
  },
  en: {
    required: 'Please fill this in.',
    invalid: 'Please check this value.',
    email: 'Please enter a valid email.',
    url: 'Please enter a valid address (https://…).',
    choose: 'Please choose one of the options.',
    number: 'Please enter a number.',
    tooLong: (max) => `This is too long (at most ${max} characters).`,
    tooShort: (min) => `This is too short (at least ${min} characters).`,
    tooSmall: (min) => `The number must be at least ${min}.`,
    tooBig: (max) => `The number must be at most ${max}.`,
    tick: 'Please tick this box to send the form.',
  },
  de: {
    required: 'Bitte ausfüllen.',
    invalid: 'Bitte prüfen Sie diesen Wert.',
    email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
    url: 'Bitte geben Sie eine gültige Adresse ein (https://…).',
    choose: 'Bitte wählen Sie eine der Möglichkeiten.',
    number: 'Bitte geben Sie eine Zahl ein.',
    tooLong: (max) => `Der Text ist zu lang (höchstens ${max} Zeichen).`,
    tooShort: (min) => `Der Text ist zu kurz (mindestens ${min} Zeichen).`,
    tooSmall: (min) => `Die Zahl muss mindestens ${min} sein.`,
    tooBig: (max) => `Die Zahl darf höchstens ${max} sein.`,
    tick: 'Bitte setzen Sie dieses Häkchen, um das Formular abzusenden.',
  },
}

/** The messages for a language code ('cs', 'cs-CZ'); English for a language without its own. */
export function formMessages(locale: string | null | undefined): Messages {
  return MESSAGES[String(locale ?? '').split(/[-_]/)[0]!.toLowerCase()] ?? MESSAGES.en!
}

interface Issue {
  code?: string
  path?: PropertyKey[]
  message?: string
  format?: string
  minimum?: number | bigint
  maximum?: number | bigint
  origin?: string
  expected?: string
  input?: unknown
  [k: string]: unknown
}

/**
 * One validation issue as the visitor should read it. `field` is the form field it is
 * about (`type`, `meta`), which says whether a choice, a number or a ticked box was meant.
 */
export function formIssueMessage(issue: Issue, field: { type?: string; meta?: Record<string, any> } | undefined, locale: string | null | undefined): string {
  const m = formMessages(locale)
  const type = field?.type
  if (type === 'boolean') return m.tick
  if (type === 'select') return m.choose
  const missing = issue.code === 'invalid_type' && /received (undefined|null)/.test(String(issue.message ?? ''))
  if (missing) return type === 'number' ? m.number : m.required
  if (issue.code === 'invalid_format' || issue.code === 'invalid_string') return issue.format === 'url' ? m.url : issue.format === 'email' ? m.email : m.invalid
  if (issue.code === 'invalid_type') return type === 'number' ? m.number : m.invalid
  if (issue.code === 'too_big') return issue.origin === 'number' || issue.origin === 'int' ? m.tooBig(Number(issue.maximum)) : m.tooLong(Number(issue.maximum))
  if (issue.code === 'too_small') {
    if (issue.origin === 'number' || issue.origin === 'int') return m.tooSmall(Number(issue.minimum))
    // An empty text is "not filled in"; a longer minimum is a rule.
    return Number(issue.minimum) <= 1 ? m.required : m.tooShort(Number(issue.minimum))
  }
  return m.invalid
}

/** The issues of a refused submission with a message in the visitor's language (the other keys stay: `code`, `path`). */
export function localizeFormIssues(issues: Issue[], fields: Record<string, { type?: string; meta?: Record<string, any> }>, locale: string | null | undefined): Issue[] {
  return issues.map((i) => ({ ...i, message: formIssueMessage(i, fields[String(i.path?.[0] ?? '')], locale) }))
}
