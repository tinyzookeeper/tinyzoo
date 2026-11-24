<script setup lang="ts">
// Čtvero dob's people: portraits 4:5 with a name, a role and a few words (on a phone the
// portrait stands beside the text), every other one set lower, and a card for newcomers with the
// phone of the person who takes the call-outs.
import type { Person } from '../../lib/cms-content'

const props = defineProps<{ block: BlockOf<'people'>; first?: boolean; anchor?: string; people: Person[] }>()
const volunteer = computed(() => volunteerOf(props.people))
</script>

<template>
  <section :id="anchor" class="scroll-mt-6" :class="first ? 'pb-20 pt-[calc(80px+5rem)] md:pb-24 md:pt-[calc(80px+6rem)]' : 'py-20 md:py-24'">
    <div class="wrap">
      <div class="grid gap-6 lg:grid-cols-12 lg:items-end">
        <component :is="first ? 'h1' : 'h2'" class="h2 lg:col-span-7"><KitMarked :text="block.heading" /></component>
        <p v-if="block.text" class="text-[1.1rem] text-ink lg:col-span-5">{{ tidy(block.text) }}</p>
      </div>
      <div class="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        <article v-for="(p, i) in people" :key="p.id" class="grid grid-cols-[6.75rem_1fr] items-center gap-x-4 sm:block" :class="i % 2 ? 'lg:translate-y-10' : ''">
          <CmsImage v-if="p.photo" :media="p.photo" sizes="(min-width: 1024px) 18rem, (min-width: 640px) 40vw, 7rem" class="aspect-[4/5] w-full rounded-[18px] object-cover sm:rounded-[28px]" />
          <div v-else class="aspect-[4/5] w-full rounded-[18px] bg-sand sm:rounded-[28px]" aria-hidden="true" />
          <div>
            <h3 class="text-[1.5rem] sm:mt-5 sm:text-[1.7rem]">{{ p.name }}</h3>
            <p v-if="p.role" class="serif text-[1.15rem] font-semibold italic text-ink">{{ p.role }}</p>
            <p v-if="p.text" class="mt-2 text-ink">{{ tidy(p.text) }}</p>
          </div>
        </article>
        <aside v-if="block.helloText" class="flex flex-col justify-between rounded-[28px] bg-jaro p-6 sm:p-7" :class="people.length % 2 ? 'lg:translate-y-10' : ''">
          <div>
            <p v-if="block.helloLabel" class="serif text-[1.15rem] font-semibold italic text-ink">{{ block.helloLabel }}</p>
            <p class="serif mt-2 text-[1.55rem] font-bold leading-[1.15] text-ink">{{ tidy(block.helloText) }}</p>
          </div>
          <div v-if="volunteer?.phone || volunteer?.email" class="mt-6">
            <a v-if="volunteer.phone" :href="telHref(volunteer.phone)" class="serif lnum flex min-h-[44px] items-center text-[1.9rem] font-extrabold leading-none text-ink hover:underline">{{ volunteer.phone }}</a>
            <a v-if="volunteer.email" :href="`mailto:${volunteer.email}`" class="u flex min-h-[44px] items-center">{{ volunteer.email }}</a>
          </div>
        </aside>
      </div>
      <div class="hidden lg:block lg:h-10" />
    </div>
  </section>
</template>
