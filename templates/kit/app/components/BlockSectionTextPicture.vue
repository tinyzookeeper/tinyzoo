<script setup lang="ts">
// Block "section_text_picture" (kitSections()): a text with a button, and a picture beside it,
// drawn by the kit for every look inside the look's own frame (KitSection). The picture is beside
// the text when the section is wide enough, and above it when it is not (a phone).
// Nothing at all when the section has nothing in it. Its texts and its picture are marked for the editor
// in the preview (cmsField; the heading by KitSection).
const props = defineProps<{ block: Record<string, any>; index?: number }>()
const plan = computed(() => textPicturePlan(props.block))
const look = computed(() => sectionLook(props.block))
// What the browser is told about the picture: the widest it is drawn, by the size chosen.
const SIZES = { half: '(min-width: 64rem) 40rem, 100vw', third: '(min-width: 64rem) 26rem, 100vw' }
</script>

<template>
  <KitSection v-if="plan" :id="`section-${block.id ?? index ?? ''}`" :heading="plan.heading" :narrow="look.narrow" :close="look.close">
    <div class="kit-tp" :class="[`kit-tp-${plan.side}`, `kit-tp-${plan.size}`, { 'kit-tp-solo': !plan.image }]">
      <div v-if="plan.body || plan.button" class="kit-tp-text">
        <CmsContent v-if="plan.body" :doc="plan.body" class="prose-look" v-bind="cmsField('body')" />
        <KitSectionButton v-if="plan.button" :to="siteHref(plan.button.href)" :label="plan.button.label" field="buttonLabel" />
      </div>
      <CmsImage v-if="plan.image" :media="plan.image" class="kit-tp-pic" :sizes="SIZES[plan.size]" :style="{ aspectRatio: plan.ratio ?? '4 / 3' }" v-bind="cmsField('image')" />
    </div>
  </KitSection>
</template>

<style>
/* The text comes first in the markup and the picture above it on a narrow section; from 48rem of
   the section's own width (it is a container, KitSection) they stand side by side. */
.kit-section .kit-tp { display: grid; grid-template-columns: minmax(0, 1fr); gap: clamp(1.75rem, 3.5vw, 2.75rem) clamp(2rem, 5vw, 4.5rem); align-items: center; }
.kit-section .kit-tp > * { min-width: 0; }
.kit-section .kit-tp .kit-tp-pic { display: block; order: -1; width: 100%; height: auto; object-fit: cover; border-radius: var(--custom-radius, 0); }
.kit-section .kit-tp .kit-tp-text { overflow-wrap: anywhere; }
.kit-section .kit-tp .kit-tp-text > .kit-btn:first-child { margin-top: 0; }
.kit-section .kit-tp.kit-tp-solo .kit-tp-text { max-width: 40rem; margin-inline: var(--custom-center, 0); }
@container (min-width: 48rem) {
  .kit-section .kit-tp-half.kit-tp-right { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .kit-section .kit-tp-half.kit-tp-left { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .kit-section .kit-tp-third.kit-tp-right { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); }
  .kit-section .kit-tp-third.kit-tp-left { grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
  .kit-section .kit-tp-right .kit-tp-pic { order: 1; }
  .kit-section .kit-tp.kit-tp-solo { grid-template-columns: minmax(0, 1fr); }
}
</style>
