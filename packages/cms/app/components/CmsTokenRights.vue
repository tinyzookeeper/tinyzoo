<script setup lang="ts">
// What an access token, or a program signing in, may do: the same questions in the same words
// on the account page and the connect page. The server holds the answer to the person's role
// either way (cmsAccessTokens.ts, clampTokenRights).
export interface CmsTokenRightsState { write: boolean; publish: boolean; delete: boolean; media: boolean; scope: 'all' | 'some'; entities: string[]; model?: boolean }

// A boolean prop left out is false in Vue, so "write allowed" needs its default: the account page does not set it.
const props = withDefaults(defineProps<{
  /** `model`: the site's own content types may be offered (an administrator, on a site with the feature). */
  can: { publish: boolean; media: boolean; model?: boolean }
  areas: { name: string; label: unknown; kind: string }[]
  /** False when the program asked only to read: writing is not offered. */
  writeAllowed?: boolean
  entitiesError?: string
}>(), { writeAllowed: true })
const state = defineModel<CmsTokenRightsState>({ required: true })
const { t, entityLabel } = useCmsI18n()
const canWrite = computed(() => props.writeAllowed !== false)
const areaItems = computed(() => props.areas.map((a) => ({ value: a.name, label: entityLabel(a as any) })))
</script>

<template>
  <div class="space-y-5">
    <fieldset class="space-y-3">
      <legend class="mb-2 text-sm font-medium text-highlighted">{{ t('account.tokens.rights') }}</legend>
      <UCheckbox :model-value="true" disabled :label="t('account.tokens.read')" />
      <template v-if="canWrite">
        <UCheckbox v-model="state.write" :label="t('account.tokens.write')" :description="t('account.tokens.writeHint')" />
        <div class="space-y-3 ps-6">
          <UCheckbox
            v-model="state.publish" :disabled="!state.write || !can.publish" :label="t('account.tokens.publish')"
            :description="can.publish ? t('account.tokens.publishHint') : t('account.tokens.notYourRole')"
          />
          <UCheckbox v-model="state.delete" :disabled="!state.write" :label="t('account.tokens.delete')" :description="t('account.tokens.deleteHint')" />
          <UCheckbox
            v-model="state.media" :disabled="!state.write || !can.media" :label="t('account.tokens.media')"
            :description="can.media ? undefined : t('account.tokens.notYourRole')"
          />
        </div>
      </template>
      <!-- for a developer's tools; never offered to a program signing in (connect page) -->
      <UCheckbox v-if="can.model" v-model="state.model" :label="t('account.tokens.model')" :description="t('account.tokens.modelHint')" />
    </fieldset>
    <UFormField :label="t('account.tokens.scope')" name="scope" :error="entitiesError || undefined">
      <URadioGroup
        v-model="state.scope"
        :items="[{ value: 'all', label: t('account.tokens.scopeAll') }, { value: 'some', label: t('account.tokens.scopeSome') }]"
      />
      <USelectMenu
        v-if="state.scope === 'some'" v-model="state.entities" multiple value-key="value" :items="areaItems"
        :placeholder="t('account.tokens.scopePick')" class="mt-3 w-full"
      />
      <template #error="{ error }"><span v-if="error" role="alert">{{ error }}</span></template>
    </UFormField>
  </div>
</template>
