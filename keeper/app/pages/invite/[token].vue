<script setup lang="ts">
import type { InvitationPreview } from '#keeper/types/keeper'

// An invitation link. A new address makes its account here; an address with an account signs
// in with its password (or is already signed in). Either way it ends in the team's Keeper.
definePageMeta({ layout: 'bare' })
useHead({ title: 'Invitation · Keeper' })

const route = useRoute()
const token = String(route.params.token ?? '')
const { loggedIn, user, fetch: refreshSession, clear } = useUserSession()

const { data: invite, error: loadError } = await useFetch<InvitationPreview>(`/api/invitations/${encodeURIComponent(token)}`, { key: `invite-${token}` })

const ROLE_LINES: Record<string, string> = {
  owner: 'You will see every site and can change everything, including who is in the workspace.',
  admin: 'You will see every site and look after the workspace, its teams and people.',
  member: 'You will see your teams’ sites, whether each is up and which tinyzoo it runs, and can add and change them.',
  guest: 'You will see whether your sites are up, their uptime and visits. You can’t change anything.',
}

const signedInAs = computed(() => (loggedIn.value ? String((user.value as { email?: string } | null)?.email ?? '') : ''))
const sameAccount = computed(() => !!invite.value && signedInAs.value === invite.value.email)
const otherAccount = computed(() => !!signedInAs.value && !sameAccount.value)

const form = reactive({ name: '', password: '' })
const busy = ref(false)
const declining = ref(false)
const declined = ref(false)
const error = ref('')

async function accept() {
  busy.value = true
  error.value = ''
  try {
    const body: Record<string, string> = { token }
    if (!sameAccount.value) {
      body.password = form.password
      if (!invite.value?.hasAccount) body.name = form.name.trim()
    }
    const res = await $fetch<{ workspace: string | null }>('/api/invitations/accept', { method: 'POST', body })
    await refreshSession()
    await refreshMe()
    await navigateTo(res.workspace ? `/w/${res.workspace}/t/all` : '/')
  }
  catch (err) {
    error.value = errorMessage(err, 'Could not accept the invitation.')
  }
  finally {
    busy.value = false
  }
}

async function decline() {
  declining.value = true
  error.value = ''
  try {
    await $fetch('/api/invitations/decline', { method: 'POST', body: { token } })
    declined.value = true
  }
  catch (err) {
    error.value = errorMessage(err, 'Could not decline the invitation.')
  }
  finally {
    declining.value = false
  }
}

async function signOut() {
  await $fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
  await clear()
}

const closed = computed(() => {
  const s = invite.value?.status
  if (declined.value) return { title: 'Invitation declined', text: 'Nothing else happens. If you change your mind, ask them to invite you again.' }
  if (s === 'accepted') return { title: 'Already accepted', text: 'This invitation has been used. Sign in to open Keeper.' }
  if (s === 'declined') return { title: 'Invitation declined', text: 'This invitation was declined. Ask them to invite you again if you want to join.' }
  if (s === 'expired') return { title: 'This invitation has expired', text: 'Invitation links work for 7 days. Ask the person who invited you to send it again.' }
  return null
})
</script>

<template>
  <div>
    <div class="mb-8 text-center">
      <KMark class="mx-auto mb-6 h-20" />
      <template v-if="loadError || !invite">
        <h1 class="k-display text-[1.75rem] leading-tight text-highlighted">This link doesn’t work</h1>
        <p class="mt-1 text-[0.9375rem] text-pretty text-(--k-moment-text)">{{ errorMessage(loadError, 'The invitation may have been sent again or taken back.') }}</p>
      </template>
      <template v-else-if="closed">
        <h1 class="k-display text-[1.75rem] leading-tight text-highlighted">{{ closed.title }}</h1>
        <p class="mt-1 text-[0.9375rem] text-pretty text-(--k-moment-text)">{{ closed.text }}</p>
      </template>
      <template v-else>
        <h1 class="k-display text-[1.75rem] leading-tight text-balance text-highlighted">Join {{ invite.workspaceName }}</h1>
        <p class="mt-1 text-[0.9375rem] text-pretty text-(--k-moment-text)">
          <template v-if="invite.inviterName">{{ invite.inviterName }} invited you</template><template v-else>You are invited</template>
          <template v-if="invite.role === 'guest' && invite.teams.length">to see how {{ invite.teams.join(', ') }} {{ invite.teams.length === 1 ? 'is' : 'are' }} doing, looked after by {{ invite.workspaceName }}.</template>
          <template v-else>to watch {{ invite.workspaceName }}’s sites with Keeper.</template>
        </p>
      </template>
    </div>

    <div v-if="loadError || !invite || closed" class="flex justify-center">
      <UButton :to="loggedIn ? '/' : '/login'" :label="loggedIn ? 'Open Keeper' : 'Sign in'" color="neutral" variant="outline" size="lg" />
    </div>

    <template v-else>
      <dl class="k-card flex flex-col gap-2.5 p-4 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Workspace</dt>
          <dd class="min-w-0 truncate text-right font-medium text-highlighted">{{ invite.workspaceName }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Your role</dt>
          <dd class="font-medium text-highlighted">{{ ROLE_LABELS[invite.role] }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">For</dt>
          <dd class="min-w-0 truncate text-right font-medium text-highlighted">{{ invite.email }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-muted">Link works until</dt>
          <dd class="font-medium text-highlighted">{{ formatDate(invite.expiresAt) }}</dd>
        </div>
        <p class="border-t border-default pt-2.5 text-pretty text-muted">{{ ROLE_LINES[invite.role] }}</p>
      </dl>

      <!-- Signed in with another account: that one can't accept it. -->
      <div v-if="otherAccount" class="mt-6 flex flex-col gap-3">
        <UAlert color="warning" variant="soft" icon="i-lucide-circle-alert" :description="`You are signed in as ${signedInAs}. This invitation is for ${invite.email}.`" />
        <UButton label="Sign out to accept it" block size="lg" color="neutral" variant="outline" @click="signOut" />
      </div>

      <form v-else class="mt-6 flex flex-col gap-4" @submit.prevent="accept">
        <template v-if="!sameAccount && invite.hasAccount">
          <p class="text-sm text-pretty text-toned">You already have a Keeper account. Enter its password to join {{ invite.workspaceName }}.</p>
          <UFormField label="Password" name="password">
            <UInput v-model="form.password" type="password" autocomplete="current-password" required autofocus class="w-full" />
          </UFormField>
        </template>
        <template v-else-if="!sameAccount">
          <UFormField label="Your name" name="name">
            <UInput v-model="form.name" autocomplete="name" required autofocus maxlength="100" class="w-full" />
          </UFormField>
          <UFormField label="Password" name="password" hint="At least 10 characters">
            <UInput v-model="form.password" type="password" autocomplete="new-password" required minlength="10" class="w-full" />
          </UFormField>
          <input type="email" :value="invite.email" autocomplete="username" class="sr-only" tabindex="-1" aria-hidden="true" readonly>
        </template>
        <UAlert v-if="error" color="error" variant="soft" icon="i-lucide-circle-alert" :description="error" />
        <UButton type="submit" :label="sameAccount || invite.hasAccount ? 'Accept and join' : 'Create account and join'" block size="lg" :loading="busy" :disabled="declining" />
        <UButton label="Decline" block size="lg" color="neutral" variant="ghost" :loading="declining" :disabled="busy" @click="decline" />
      </form>
    </template>
  </div>
</template>
