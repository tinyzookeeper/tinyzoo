<script setup lang="ts">
// The sharing image (nuxt-og-image, Satori): drawn on request from the page's title and
// description, in the site's look — cream, the logo, a Manrope headline and the animal
// parade. Inline styles only: Satori knows a subset of CSS and lays out content-box, so
// the root sets box-sizing. Manrope comes from @nuxt/fonts (global, latin-ext), so
// ě š č ř ž ů and ä ö ü ß render.
const { title = 'tinyzoo', description = '', host = '' } = defineProps<{ title?: string, description?: string, host?: string }>()

// Long headlines get smaller type so they stay within three lines.
const titleSize = computed(() => (title.length > 60 ? 54 : title.length > 34 ? 64 : 78))
// Three lines of description at most: cut at a word and end with an ellipsis.
const text = computed(() => {
  const d = description.replace(/\s+/g, ' ').trim()
  if (d.length <= 130) return d
  return `${d.slice(0, 130).replace(/\s+\S*$/, '')}…`
})
const parade = [
  { name: 'bunny', h: 92 }, { name: 'bird', h: 112 }, { name: 'fox', h: 92 },
  { name: 'frog', h: 112 }, { name: 'octopus', h: 92 }, { name: 'elephant', h: 112 },
]
</script>

<template>
  <div style="display: flex; position: relative; box-sizing: border-box; width: 1200px; height: 630px; background-color: #F9F5EF; font-family: 'Manrope'; color: #131313;">
    <!-- the animals stand on the bottom edge, on the right -->
    <div style="display: flex; position: absolute; right: 72px; bottom: 0; align-items: flex-end;">
      <img v-for="a in parade" :key="a.name" :src="`/animals/${a.name}.svg`" alt="" :height="a.h" :style="{ height: `${a.h}px` }">
    </div>

    <!-- text on its own layer: absolutely positioned siblings would paint over normal-flow text -->
    <div style="display: flex; position: absolute; top: 0; left: 0; flex-direction: column; justify-content: space-between; box-sizing: border-box; width: 1200px; height: 630px; padding: 64px 80px 56px;">
      <img src="/brand/logo-primary.svg" alt="tinyzoo" width="230" height="50" style="width: 230px; height: 50px;">

      <div style="display: flex; flex-direction: column; max-width: 980px;">
        <div :style="{ fontSize: `${titleSize}px` }" style="display: flex; font-weight: 800; line-height: 1.08; letter-spacing: -0.025em;">
          {{ title }}
        </div>
        <div v-if="text" style="display: flex; margin-top: 26px; font-size: 30px; font-weight: 500; line-height: 1.4; color: #6B6A66; max-width: 900px;">
          {{ text }}
        </div>
      </div>

      <div style="display: flex; align-items: center; height: 92px; font-size: 24px; font-weight: 700; color: #2E3035;">
        {{ host }}
      </div>
    </div>
  </div>
</template>
