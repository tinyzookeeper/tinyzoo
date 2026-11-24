<script setup lang="ts">
// Obálka's search page: the word searched for as a large underlined field, the articles found
// under it as ruled rows.
const props = defineProps<{ block: BlockOf<'search'>; first?: boolean; anchor?: string }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const search = await useSearch()
</script>

<template>
  <section :id="anchor" class="wrap py-14 lg:py-24">
    <div class="mx-auto max-w-[52rem]">
      <component :is="tag" class="font-display text-[3rem] font-extralight leading-none tracking-[-0.025em] lg:text-[4.2rem]"><KitMarked :text="block.heading" /></component>
      <form role="search" class="mt-8 flex items-center gap-3 border-b border-ink pb-2" @submit.prevent="search.submit">
        <UIcon name="i-lucide-search" class="text-xl" aria-hidden="true" />
        <label for="q-page" class="sr-only">{{ words.searchLabel }}</label>
        <input id="q-page" v-model="search.q.value" type="search" name="q" :placeholder="words.searchPlaceholder" class="search-input h-12 w-full bg-transparent font-display text-[1.5rem] placeholder:text-quiet focus:outline-none" data-search-input>
        <button type="submit" class="byline cursor-pointer text-brand">{{ words.search }}</button>
      </form>
      <p v-if="!search.asked.value && block.text" class="mt-6 font-display text-[1.15rem] leading-[1.55]">{{ tidyText(block.text) }}</p>
      <template v-else-if="search.asked.value">
        <p class="byline mt-6 text-quiet" role="status">{{ search.total.value ? words.found(search.total.value, search.term.value) : words.nothingFound(search.term.value) }}</p>
        <ol v-if="search.items.value.length" class="mt-4" data-search-results>
          <li v-for="r in search.items.value" :key="r.id" class="border-t border-ink/20 first:border-ink">
            <NuxtLink :to="r.path" class="block py-5">
              <span class="block font-display text-[1.55rem] leading-[1.22]"><span class="lift">{{ tidyText(r.title) }}</span></span>
              <span v-if="r.excerpt" class="mt-2 block font-display text-[1.05rem] leading-[1.5] text-quiet">{{ r.excerpt }}</span>
            </NuxtLink>
          </li>
        </ol>
      </template>
    </div>
  </section>
</template>
