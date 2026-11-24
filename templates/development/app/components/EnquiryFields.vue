<script setup lang="ts">
// The fields of the enquiry form, the same in every look (each look's stylesheet draws `.field`
// and `.check` its own way): name, phone, e-mail, the flat (a choice of the flats that are not
// sold), what the visitor wants us to do (the choices the developer listed in the block, as ticks)
// and a message. A question the developer left empty in the block is not asked. Goes inside the
// look's <form>; the look sets the spacing between the three groups.
import type { SiteForm } from '#imports'
import type { Flat } from '~/lib/cms-content'

const props = defineProps<{
  form: SiteForm
  block: BlockOf<'enquiry'>
  flats: Flat[]
  /** The look's own wording of the question about the flat. */
  unitLabel: string
  /** The class of the look's group labels (the legend of the ticks). */
  legendClass?: string
  /** Gaps and distances the look sets: between fields, above the ticks, above the message. */
  fieldsGap?: string
  ticksTop?: string
  ticksGap?: string
  legendGap?: string
  messageTop?: string
}>()
const form = props.form
const words = useSiteWords()
const { asked } = useFlatBrowser()
const wants = computed(() => props.block.wants.map((w) => w.name).filter(Boolean))
const flats = computed(() => askableFlats(props.flats))
const fields = computed(() => Object.fromEntries(form.fields.value.map((f) => [f.key, f])))

// The ticks: the first is ticked until the visitor chooses, as the designs show it.
const chosen = ref<string[]>([])
watch(wants, (list) => { chosen.value = chosen.value.filter((c) => list.includes(c)); if (!chosen.value.length && list.length) chosen.value = [list[0]!] }, { immediate: true })
watch(chosen, (list) => { form.values.wants = wants.value.filter((w) => list.includes(w)).join(', ') }, { immediate: true, deep: true })
// A flat the visitor asked about with "I'm interested" is chosen in the select.
watch(asked, (number) => { if (number) form.values.unit = number }, { immediate: true })
if (form.values.unit === undefined) form.values.unit = ''
</script>

<template>
  <div class="grid sm:grid-cols-2" :class="fieldsGap ?? 'gap-5'">
    <div v-if="fields.name" class="field sm:col-span-2">
      <label :for="form.id('name')">{{ fields.name.label }}</label>
      <input :id="form.id('name')" v-model="form.values.name" name="name" type="text" autocomplete="name" required :maxlength="fields.name.max ?? undefined" :aria-invalid="!!form.errors.name">
      <p v-if="form.errors.name" class="field-error">{{ form.errors.name }}</p>
    </div>
    <div v-if="fields.phone" class="field">
      <label :for="form.id('phone')">{{ fields.phone.label }}</label>
      <input :id="form.id('phone')" v-model="form.values.phone" name="phone" type="tel" autocomplete="tel" placeholder="+420" required :maxlength="fields.phone.max ?? undefined" :aria-invalid="!!form.errors.phone">
      <p v-if="form.errors.phone" class="field-error">{{ form.errors.phone }}</p>
    </div>
    <div v-if="fields.email" class="field">
      <label :for="form.id('email')">{{ fields.email.label }}</label>
      <input :id="form.id('email')" v-model="form.values.email" name="email" type="email" autocomplete="email" required :maxlength="fields.email.max ?? undefined" :aria-invalid="!!form.errors.email">
      <p v-if="form.errors.email" class="field-error">{{ form.errors.email }}</p>
    </div>
    <div v-if="fields.unit" class="field sm:col-span-2">
      <label :for="form.id('unit')">{{ unitLabel }}</label>
      <select :id="form.id('unit')" v-model="form.values.unit" name="unit" data-unit>
        <option value="">{{ words.unitUnknown }}</option>
        <option v-for="f in flats" :key="f.id" :value="f.number">{{ flatOption(f, words) }}</option>
      </select>
    </div>
  </div>

  <fieldset v-if="wants.length" :class="ticksTop ?? 'mt-6'">
    <legend :class="legendClass ?? 'label'">{{ words.wantsLegend }}</legend>
    <div class="grid sm:grid-cols-2" :class="[ticksGap ?? 'gap-x-5', legendGap ?? 'mt-2']">
      <label v-for="w in wants" :key="w" class="check"><input v-model="chosen" type="checkbox" name="want" :value="w"><span>{{ w }}</span></label>
    </div>
  </fieldset>

  <div v-if="fields.message" class="field" :class="messageTop ?? 'mt-5'">
    <label :for="form.id('message')">{{ fields.message.label }}</label>
    <textarea :id="form.id('message')" v-model="form.values.message" name="message" rows="3" :maxlength="fields.message.max ?? undefined" />
  </div>
  <KitFormExtras :form="form" />
  <p v-if="form.failure.value" class="field mt-4"><span class="field-error" role="alert">{{ form.failure.value }}</span></p>
</template>
