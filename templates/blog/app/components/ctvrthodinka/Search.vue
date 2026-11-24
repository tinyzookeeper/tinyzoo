<script setup lang="ts">
// Čtvrthodinka's search page: the word searched for in a pill, the articles found under it, each
// with a clock.
const props = defineProps<{ block: BlockOf<'search'>; first?: boolean; anchor?: string }>()
const { words } = await useBlog()
const tag = await useHeadingTag(() => props.first)
const search = await useSearch()
</script>

<template>
  <section :id="anchor" class="wrap py-14 lg:py-24">
    <div class="max-w-[52rem]">
      <component :is="tag" class="text-[2.9rem] font-black leading-[0.94] tracking-[-0.045em] lg:text-[4.6rem]"><KitMarked :text="block.heading" /></component>
      <form role="search" class="mt-8 flex h-14 items-center gap-3 rounded-full bg-panel pl-6 pr-2" @submit.prevent="search.submit">
        <UIcon name="i-lucide-search" class="text-xl text-quiet" aria-hidden="true" />
        <label for="q-page" class="sr-only">{{ words.searchLabel }}</label>
        <input id="q-page" v-model="search.q.value" type="search" name="q" :placeholder="words.searchPlaceholder" class="search-input w-full bg-transparent text-lg font-medium placeholder:text-quiet focus:outline-none" data-search-input>
        <button type="submit" class="h-10 cursor-pointer rounded-full bg-brand px-5 font-bold text-brand-ink">{{ words.search }}</button>
      </form>
      <p v-if="!search.asked.value && block.text" class="stand mt-6 text-[1.3rem] text-quiet">{{ tidyText(block.text) }}</p>
      <template v-else-if="search.asked.value">
        <p class="meta mt-6" role="status">{{ search.total.value ? words.found(search.total.value, search.term.value) : words.nothingFound(search.term.value) }}</p>
        <ol v-if="search.items.value.length" class="mt-4" data-search-results>
          <li v-for="r in search.items.value" :key="r.id" class="border-t border-rule last:border-b">
            <NuxtLink :to="r.path" class="block py-5">
              <span class="head block text-[1.5rem]"><span class="lift">{{ tidyText(r.title) }}</span></span>
              <span v-if="r.excerpt" class="stand mt-2 block text-[1.2rem] text-quiet">{{ r.excerpt }}</span>
            </NuxtLink>
          </li>
        </ol>
      </template>
    </div>
  </section>
</template>
