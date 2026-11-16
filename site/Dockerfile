# The tinyzoo website (and the public demo: the same image with other settings) on
# Pushbase or any container host. The site is a workspace member, so the build runs
# from the repo root: `node scripts/deploy-site.mjs` uploads the repo with this file
# as its root Dockerfile (Pushbase's "dockerfile" preset).
#
# Runtime: only .output ships, plus the seed (scripts/ and seed/, plain Node) so the
# demo can reset itself every night. Migrations are bundled and applied at start
# (NUXT_CMS_MIGRATIONS_ON_START=true). See docs/deploying.md for the environment.
FROM node:22-alpine AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=4096
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter ./site...
RUN pnpm --filter ./site build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /repo/site/.output ./.output
# The content seed: `node scripts/seed.mjs` / `node scripts/reset.mjs` (no dependencies).
COPY --from=build /repo/site/scripts ./scripts
COPY --from=build /repo/site/seed ./seed
# Media on the container's own disk until a bucket is set up (NUXT_CMS_STORAGE_DRIVER=s3):
# it does not survive a redeploy — the seed puts the site's own pictures back.
RUN mkdir -p /app/data && chown node:node /app/data
ENV NUXT_CMS_STORAGE_LOCAL_DIR=/app/data/uploads NUXT_CMS_MAIL_FILE_DIR=/app/data/mail
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
