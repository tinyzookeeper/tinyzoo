<script setup lang="ts">
// The website's frame: the look's header and footer around the page. The look and its colours
// come from the site's settings and go onto <html>, so the first answer of the server is
// already drawn right; the look's styles are in app/assets/css/<look>.css.
const { look } = await useSite()
useLookHead(look)
useHead({ htmlAttrs: { lang: DEFAULT_LANGUAGE } })
</script>

<template>
  <div class="site">
    <LookPart part="Header" />
    <main>
      <slot />
    </main>
    <LookPart part="Footer" />
  </div>
</template>
