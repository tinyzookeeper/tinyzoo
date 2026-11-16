// Ask before something that cannot be taken back (leaving unsaved changes, discarding,
// deleting) — in the admin's own dialog, not the browser's grey confirm box.
//
//   const confirm = useCmsConfirm()
//   if (!await confirm({ title: t('media.deleteTitle'), confirmLabel: t('common.delete'), color: 'error' })) return
//
// The admin layout renders the one dialog (CmsConfirmDialog). Asking again while a
// question is open answers the old one with "no".
// (Closing the browser tab with unsaved changes still gets the browser's own prompt:
// pages cannot draw anything there.)
export interface CmsConfirmOptions {
  title: string
  description?: string
  /** The button that goes ahead, e.g. "Leave without saving". */
  confirmLabel?: string
  /** The safe way out, e.g. "Stay". */
  cancelLabel?: string
  icon?: string
  /** error: something is deleted for good (red). warning / primary stay calm and only pick the default icon. */
  color?: 'error' | 'warning' | 'primary'
}

interface CmsConfirmQuestion extends CmsConfirmOptions { resolve: (ok: boolean) => void }

// Only ever set in the browser (the dialog opens on a click), so one per tab is right.
const question = shallowRef<CmsConfirmQuestion | null>(null)

export function useCmsConfirm() {
  return (options: CmsConfirmOptions) => new Promise<boolean>((resolve) => {
    if (import.meta.server) return resolve(false)
    question.value?.resolve(false)
    question.value = { ...options, resolve }
  })
}

/** The question being asked (for the dialog, and for shortcuts that should wait while it is open). */
export function useCmsConfirmQuestion() {
  return question
}
