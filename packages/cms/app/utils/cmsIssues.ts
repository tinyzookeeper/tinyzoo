// A failed save names what is wrong per field in the validator's own words ("Invalid
// input: expected string, received undefined"). Editors get a plain sentence in their
// language instead, by the kind of problem; a message the developer wrote (a custom
// rule) is kept as it is.
type T = (key: string, params?: Record<string, any>) => string

export function cmsIssueMessage(issue: any, field: any, t: T): string {
  const code = issue?.code
  const msg = String(issue?.message ?? '')
  const empty = /received (undefined|null)\b/.test(msg)
  switch (code) {
    case 'invalid_type':
      if (empty) return field?.type === 'datetime' || field?.type === 'date' ? t('validation.pickDate') : t('validation.required')
      if (issue.expected === 'date') return t('validation.pickDate')
      return t('validation.invalid')
    case 'too_small':
      if (issue.origin === 'string') return issue.minimum <= 1 ? t('validation.required') : t('validation.minLength', { n: issue.minimum })
      if (issue.origin === 'array') return issue.minimum <= 1 ? t('validation.pickOne') : t('validation.minItems', { n: issue.minimum })
      return t('validation.min', { n: issue.minimum })
    case 'too_big':
      if (issue.origin === 'string') return t('validation.maxLength', { n: issue.maximum })
      if (issue.origin === 'array') return t('validation.maxItems', { n: issue.maximum })
      return t('validation.max', { n: issue.maximum })
    case 'invalid_format':
      if (issue.format === 'email') return t('validation.email')
      if (issue.format === 'url') return t('validation.url')
      if (field?.type === 'slug') return t('validation.slug')
      if (field?.meta?.format === 'color') return t('fields.colorHint')
      if (field?.meta?.format === 'path' || msg.startsWith('Start with /')) return t('validation.path')
      return t('validation.invalid')
    case 'invalid_value':
      return t('validation.pickOption')
    case 'unique':
      return t('validation.unique')
    case 'redirect_loop':
      return t('validation.redirectLoop')
    case 'redirect_circle':
      return t('validation.redirectCircle')
    case 'custom':
      // The developer's own words ("Use /page, https://…") — known ones translated.
      if (msg.startsWith('Use /page')) return t('validation.link')
      // The server's words about a block (see blocksSchema), in the editor's language.
      if (msg.startsWith('This block could not be brought up to date')) return t('validation.blockStale')
      if (msg.startsWith('This block is out of date')) return t('validation.blockOutOfDate')
      if (msg.startsWith('This block has fields this site does not know')) return t('validation.blockUnknownFields', { keys: /\(([^)]*)\)/.exec(msg)?.[1] ?? '' })
      if (msg === 'Unknown block type' || msg.startsWith('This block type does not exist')) return t('validation.blockTypeGone')
      if (msg.startsWith('Saved by a newer version of this site')) return t('validation.blockNewer')
      return msg
    default:
      if (msg === 'Wrong password') return t('validation.wrongPassword')
      return t('validation.invalid')
  }
}

/**
 * Toast text for a refused delete: "still in use" names where (up to five titles),
 * anything else gives the server's reason.
 */
export function cmsDeleteFailure(err: any, t: T, name?: (label: unknown) => string): { title: string; description?: string } {
  const data = err?.data?.data
  if (data?.code === 'in_use') {
    const short = (s: string) => (s.length > 40 ? s.slice(0, 39).trimEnd() + '…' : s)
    const used: any[] = data.usedBy ?? []
    // A global (a menu, the site settings) has no title: it is named by its collection.
    const named = (u: any) => (u.title ? `„${short(String(u.title))}“` : u.singleton && name ? name(u.label) : '')
    const titles: string[] = used.map(named).filter(Boolean)
    const items = titles.length ? [...new Set(titles)].slice(0, 5).join(', ') + (titles.length > 5 ? '…' : '') : '—'
    // Links to a page by reference (a menu, a button) have their own wording: remove the links.
    const onlyLinks = used.length > 0 && used.every((u) => u.via === 'link')
    return { title: t('list.inUseTitle'), description: t(onlyLinks ? 'list.inUseLinkBody' : 'list.inUseBody', { items }) }
  }
  return { title: t('list.deleteFailed'), description: cmsRequestError(err, t) }
}

/**
 * A failed request in words an editor can act on (never "[PATCH] … Failed to fetch"):
 * offline, not allowed, too large, a file type we don't take, too many tries, a server
 * problem — otherwise the server's own reason.
 */
export function cmsRequestError(err: any, t: T, extra: { maxMb?: number } = {}): string {
  const status = err?.statusCode ?? err?.status ?? err?.response?.status
  if (!status) return t('errors.offline')
  if (status === 400 && err?.data?.statusMessage === 'The file is empty') return t('errors.emptyFile')
  if (status === 401) return t('errors.signedOut')
  if (status === 403) return t('errors.forbidden')
  if (status === 413) return extra.maxMb ? t('errors.tooLargeMax', { mb: extra.maxMb }) : t('errors.tooLarge')
  if (status === 415) return t('errors.fileType')
  if (status === 429) return t('errors.tooMany')
  if (status >= 500) return t('errors.server')
  return err?.data?.statusMessage ?? err?.message ?? t('errors.server')
}
