<script setup lang="ts">
// What every website form carries besides its fields: the field people never see (robots
// fill it) and Cloudflare Turnstile when the site has a key. Goes inside the <form>.
import type { SiteForm } from '../composables/useSiteForm'

defineProps<{ form: SiteForm }>()
</script>

<template>
  <div class="kit-form-hp" aria-hidden="true">
    <label>Website <input type="text" name="website" tabindex="-1" autocomplete="off"></label>
  </div>
  <div v-if="form.turnstileSiteKey.value" class="cf-turnstile" :data-sitekey="form.turnstileSiteKey.value" />
</template>

<style>
.kit-form-hp { position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden; }
</style>
