// The secret value that the starter's `.env.example` has always had (as `NUXT_SESSION_PASSWORD` before 0.4,
// as `NUXT_APP_SECRET` since). Anybody can read it in the repository (and on npm), so a site that runs with it seals its sign-in cookie with a
// key the whole world knows. A site made with `tinyzoo init` / `pnpm create tinyzoo` gets its own
// random value in `.env`; a production server refuses this one (server/plugins/cms-0-config-check.ts),
// a development server warns. A test (test/unit/app-secret.spec.ts) keeps it equal to the starter's file.
export const CMS_EXAMPLE_APP_SECRET = 'change-me-to-a-long-random-string-32-chars-min'

/** Why production refuses the example secret, naming the variable and how to make a real one. */
export function cmsExampleSecretRefusal(name: string): string {
  return `${name} is the example value from the starter's .env.example, which anyone can read, so anyone could forge a sign-in cookie. `
    + 'Set a secret of your own in the environment of the server (at least 32 characters). Make one with: openssl rand -base64 32'
}

/** What development says about it: fine on this machine, never on a server. */
export function cmsExampleSecretWarning(name: string): string {
  return `[cms] ${name} is the example value from .env.example. That is fine on this machine, but a production server refuses it and does not start. `
    + 'Make a secret of your own with: openssl rand -base64 32'
}
