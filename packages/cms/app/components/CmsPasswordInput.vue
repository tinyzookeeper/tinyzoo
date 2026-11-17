<script setup lang="ts">
// Password field with a show/hide toggle.
defineProps<{ autocomplete?: string; placeholder?: string; autofocus?: boolean }>()
const model = defineModel<string>({ default: '' })
const visible = ref(false)
const { t } = useCmsI18n()
</script>

<template>
  <UInput
    v-model="model" :type="visible ? 'text' : 'password'" :autocomplete="autocomplete ?? 'current-password'"
    :placeholder="placeholder" :autofocus="autofocus" class="w-full" :ui="{ trailing: 'pe-1' }"
  >
    <template #trailing>
      <UButton
        color="neutral" variant="link" size="sm" :icon="visible ? 'i-lucide-eye-off' : 'i-lucide-eye'"
        :aria-label="visible ? t('auth.hidePassword') : t('auth.showPassword')" :aria-pressed="visible"
        @click="() => { visible = !visible }"
      />
    </template>
  </UInput>
</template>
