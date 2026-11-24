<script setup lang="ts">
// Magnets' closing call: on the orange, the heading set as three shift bars like the opening, a
// few words, and one field for an e-mail address.
import type { SiteForm } from '#imports'

const props = defineProps<{ block: BlockOf<'cta'>; first?: boolean; anchor?: string; form: SiteForm }>()
const words = useSiteWords()
const form = props.form
const bars = computed(() => barsOf(props.block.heading))
const size = computed(() => byLength(props.block.heading, [[26, 'text-[52px] sm:text-[88px] lg:text-[104px]'], [40, 'text-[40px] sm:text-[64px] lg:text-[76px]']], 'text-[32px] sm:text-[48px] lg:text-[56px]'))
</script>

<template>
  <section :id="anchor" class="bg-brand">
    <div class="wrap py-14 lg:py-24">
      <component :is="first ? 'h1' : 'h2'" class="grid grid-cols-4 gap-2 lg:grid-cols-7 lg:grid-rows-[repeat(3,128px)] lg:gap-2.5">
        <span class="bar col-span-4 h-[76px] w-fit bg-cream sm:h-[110px] lg:col-span-4 lg:col-start-1 lg:h-auto lg:w-auto" :class="size">{{ bars[0] }}</span>{{ ' ' }}
        <span class="bar col-span-4 ml-6 h-[76px] w-fit bg-ink text-cream sm:ml-24 sm:h-[110px] lg:col-span-3 lg:col-start-3 lg:ml-0 lg:h-auto lg:w-auto" :class="size">{{ bars[1] }}</span>{{ ' ' }}
        <span v-if="bars[2]" class="bar col-span-4 ml-12 h-[76px] w-fit bg-sky sm:ml-48 sm:h-[110px] lg:col-span-3 lg:col-start-5 lg:ml-0 lg:h-auto lg:w-auto" :class="size">{{ bars[2] }}</span>
      </component>
      <div class="mt-8 grid gap-6 lg:mt-10 lg:grid-cols-7 lg:gap-2.5">
        <p v-if="block.text" class="text-[19px] leading-[1.45] lg:col-span-3 lg:text-[22px]"><KitMarked :text="block.text" as="b" :attrs="{ class: 'font-semibold' }" /></p>
        <div class="lg:col-span-4 lg:col-start-4 lg:pl-6">
          <p v-if="form.sent.value" class="rounded-[20px] bg-cream px-5 py-4 text-[16px] font-medium" role="status">{{ form.successMessage.value }}</p>
          <form v-else-if="!form.unavailable.value" :ref="form.el" class="flex flex-col gap-2.5 sm:flex-row sm:items-start" novalidate @submit.prevent="form.submit">
            <label class="sr-only" :for="form.id('email')">{{ words.emailLabel }}</label>
            <input :id="form.id('email')" v-model="form.values.email" type="email" name="email" required autocomplete="email" :placeholder="words.emailPlaceholder" :aria-invalid="!!form.errors.email" class="h-[54px] min-w-0 rounded-full border-2 border-ink bg-cream px-6 text-[17px] text-ink placeholder:text-ink/60 sm:flex-1">
            <button type="submit" class="btn btn-ink" :disabled="form.sending.value">{{ form.sending.value ? words.sending : block.buttonLabel }} <UIcon name="i-lucide-arrow-right" class="size-5" aria-hidden="true" /></button>
            <KitFormExtras :form="form" />
          </form>
          <p v-if="form.errors.email || form.failure.value" class="mt-3 text-[15px] font-medium" role="alert">{{ form.errors.email || form.failure.value }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
