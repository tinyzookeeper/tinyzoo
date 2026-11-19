<!--
  <CmsConsent> with two of its slots (docs/consent.md, "Slots of <CmsConsent>"): its own buttons
  in the banner, and its own row per category in the settings. The rest, the dialog and the
  default styles stay. The playground shows it with ?banner=slots.
-->
<template>
  <CmsConsent>
    <template #actions="{ texts, acceptAll, rejectAll, open, saving }">
      <button type="button" class="cms-consent__btn" :disabled="saving" @click="rejectAll()">{{ texts.rejectAll }}</button>
      <button type="button" class="cms-consent__btn" :disabled="saving" @click="acceptAll()">{{ texts.acceptAll }}</button>
      <button type="button" class="cms-consent__btn cms-consent__btn--quiet" @click="open()">🍪 {{ texts.settings }}</button>
    </template>

    <template #category="{ category, draft, texts }">
      <label class="flex items-start justify-between gap-4">
        <span>
          <strong>{{ category.label }}</strong>
          <small class="block opacity-80">{{ category.description }}</small>
          <small v-if="category.services.length" class="block opacity-80">
            {{ texts.services }}: {{ category.services.map((s) => s.name).join(', ') }}
          </small>
        </span>
        <input v-model="draft[category.key]" type="checkbox" class="size-5" :disabled="category.required">
      </label>
    </template>
  </CmsConsent>
</template>
