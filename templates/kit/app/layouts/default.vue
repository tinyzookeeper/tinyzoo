<script setup lang="ts">
// The website's frame: the look's header and footer around the page. The look and its colours
// come from the site's settings and go onto <html>, so the first answer of the server is
// already drawn right; the look's styles are in app/assets/css/<look>.css. In the admin's
// preview a line tells the editor when their own colour is shown lighter or darker than given.
const design = useDesign()
const { look, ownNote } = await useSite()
useLookHead(look)
useHead({ htmlAttrs: { lang: design.site.DEFAULT_LANGUAGE } })
// A visitor may add ?preview to an address too: the line is shown only where the server
// answered as to a signed-in editor (the page asks with the same key, so nothing is fetched twice).
const { isPreview } = await useSitePage()
</script>

<template>
  <div class="site">
    <SiteOwnNote v-if="ownNote && isPreview" :given="ownNote.given" :shown="ownNote.shown" />
    <LookPart part="Header" />
    <main>
      <slot />
    </main>
    <LookPart part="Footer" />
  </div>
</template>
