<script setup lang="ts">
// A change refused because the website's code reads what it takes away (409 `breaks-code`): the
// words of the refusal (cmsModelCodeRefusalText), and one quiet link to the list of that code on
// the first screen of Content types. `alert` draws it as the dialog's other refusals at its foot;
// without it, it stands in the dialog's body as "still used" does. `leave`: the link was followed.
defineProps<{ text: string; alert?: boolean }>()
const emit = defineEmits<{ leave: [] }>()
const { t } = useCmsI18n()
const to = '/admin/_model#cms-model-code'
</script>

<template>
  <UAlert v-if="alert" color="error" variant="subtle" icon="i-lucide-circle-alert" :title="text" role="alert" data-cms-error-summary>
    <template #description>
      <NuxtLink :to="to" class="mt-1 inline-block text-sm text-muted underline underline-offset-2 hover:text-highlighted" @click="emit('leave')">{{ t('model.code.seeAll') }}</NuxtLink>
    </template>
  </UAlert>
  <div v-else class="flex flex-col gap-2" role="alert">
    <p class="flex items-start gap-3 text-sm text-default text-pretty">
      <UIcon name="i-lucide-code-xml" class="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
      <span>{{ text }}</span>
    </p>
    <NuxtLink :to="to" class="ms-7 self-start text-sm text-muted underline underline-offset-2 hover:text-highlighted" @click="emit('leave')">{{ t('model.code.seeAll') }}</NuxtLink>
  </div>
</template>
