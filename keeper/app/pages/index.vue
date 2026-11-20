<script setup lang="ts">
// The way in: the workspace and team you were in last, or your first workspace. Someone in no
// workspace (removed from every one) is told so.
const me = useMe()
const to = homePath(me.value, useLastScope().value)
if (to) await navigateTo(to, { replace: true })
useHead({ title: 'Keeper' })
const { signOut } = useKeeperUser()
</script>

<template>
  <AppPage title="Keeper" :heading="false">
    <div class="k-card">
      <KEmpty animal="owl" title="You are not in any workspace" description="Ask someone to invite you to theirs. Their invitation brings you straight in.">
        <UButton label="Sign out" color="neutral" variant="outline" @click="signOut" />
      </KEmpty>
    </div>
  </AppPage>
</template>
