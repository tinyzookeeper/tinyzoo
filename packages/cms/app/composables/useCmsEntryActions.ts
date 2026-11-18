// Entry actions shared by the editor's "…" menu and the list's row menu: duplicate
// (a draft copy, opened at once) and delete (asked first; a refusal names what still
// uses the entry).
export function useCmsEntryActions() {
  const { t, tl } = useCmsI18n()
  const toast = useToast()
  const confirm = useCmsConfirm()

  /**
   * A copy of the entry as a new draft: "(copy)" after the title, "-copy" after
   * unique addresses, not published. Translations are not copied (the copy is a new
   * thing to translate). Returns the new id, or null when the copy was refused.
   */
  async function duplicate(entity: string, meta: any, id: string): Promise<string | null> {
    try {
      const { row } = await cmsFetch<{ row: Record<string, any> }>(`/api/cms/${entity}/${id}`)
      const body: Record<string, any> = {}
      for (const f of (meta?.fields ?? []) as any[]) {
        // Not a field this person may not edit (the server refuses a write that names one): the copy starts without it.
        if (f.relation?.kind === 'one-to-many' || f.key === meta?.orderField || f.readOnly) continue
        const v = row[f.key]
        if (v === undefined || (v === null && f.optional)) continue
        body[f.key] = v
      }
      const tf = meta?.titleField
      if (tf && typeof body[tf] === 'string') body[tf] = `${body[tf]} ${t('editor.copySuffix')}`
      const p = meta?.publish
      if (p) {
        body[p.field] = p.draftValue
        if (p.dateField) body[p.dateField] = null
      }
      // Unique values get "-copy", then "-copy-2", "-copy-3"… until one is free.
      const unique = ((meta?.fields ?? []) as any[]).filter((f) => (f.type === 'slug' || f.unique) && typeof body[f.key] === 'string' && body[f.key])
      const original = Object.fromEntries(unique.map((f) => [f.key, body[f.key] as string]))
      let res: { row: { id: string } } | null = null
      for (let n = 1; n <= 8 && !res; n++) {
        for (const f of unique) body[f.key] = `${original[f.key]}-${t('editor.copySlug')}${n > 1 ? `-${n}` : ''}`
        try {
          res = await cmsFetch<{ row: { id: string } }>(`/api/cms/${entity}`, { method: 'POST', body })
        }
        catch (err: any) {
          const taken = err?.statusCode === 409 && Array.isArray(err?.data?.data) && err.data.data.some((i: any) => i?.code === 'unique')
          if (!taken || !unique.length || n === 8) throw err
        }
      }
      if (!res) return null
      toast.add({ title: t('editor.duplicated'), icon: 'i-lucide-copy', color: 'success' })
      return res.row.id
    }
    catch (err: any) {
      toast.add({ title: t('editor.duplicateFailed'), description: cmsRequestError(err, t as any), icon: 'i-lucide-x', color: 'error' })
      return null
    }
  }

  /** Delete after asking. True when it is gone. */
  async function remove(entity: string, meta: any, id: string, title?: string | null): Promise<boolean> {
    const ok = await confirm({
      title: t('editor.deleteTitle', { name: title || tl(meta?.labelSingular, entity) }),
      description: t('editor.deleteBody'), icon: 'i-lucide-trash-2', color: 'error',
      confirmLabel: t('common.delete'), cancelLabel: t('common.cancel'),
    })
    if (!ok) return false
    try {
      await cmsFetch(`/api/cms/${entity}/${id}`, { method: 'DELETE' })
      toast.add({ title: t('list.deleted'), icon: 'i-lucide-check', color: 'success' })
      return true
    }
    catch (err: any) {
      toast.add({ ...cmsDeleteFailure(err, t as any, (label) => tl(label as any)), icon: 'i-lucide-x', color: 'error' })
      return false
    }
  }

  return { duplicate, remove }
}
