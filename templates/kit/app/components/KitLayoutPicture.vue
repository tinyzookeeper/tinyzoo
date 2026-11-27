<script setup lang="ts">
// A picture of a Layout section (BlockSectionLayout), drawn by <CmsBlocks prefix="KitLayout">: cut to
// its shape (its own when original), with the look's corners. One root element. Empty (only while
// editing): a frame of its shape with a picture icon. The picture is marked for the editor in the preview
// (cmsField): a click brings its field into view in the admin's panel, a double click opens the chooser.
import type { LayoutPicture } from '../utils/layout'

defineProps<{ block: LayoutPicture; index?: number }>()
</script>

<template>
  <div class="kit-lay-item kit-lay-picture" :class="[`kit-lay-${block.size}`, block.empty ? 'kit-lay-ghost' : '']">
    <span v-if="block.empty || !block.image" class="kit-lay-ghost-frame" :style="{ aspectRatio: block.ratio ?? '4 / 3' }" aria-hidden="true" v-bind="cmsField('image')">
      <svg viewBox="0 0 24 24"><rect width="18" height="18" x="3" y="3" rx="2" ry="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" /></svg>
    </span>
    <CmsImage v-else :media="block.image" class="kit-lay-img" sizes="(min-width: 64rem) 50vw, 100vw" :style="block.ratio ? { aspectRatio: block.ratio } : undefined" v-bind="cmsField('image')" />
  </div>
</template>
