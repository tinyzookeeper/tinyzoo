# Staging deploy of the playground (the demo site + admin) on Pushbase, or any
# container host. The playground lives in a workspace subfolder, so the build runs
# from the repo root (Pushbase's "dockerfile" preset picks this file up).
#
# Runtime: only .output ships. Migrations are bundled and applied at start when
# NUXT_CMS_MIGRATIONS_ON_START=true. See docs/deploying.md for the environment.
FROM node:22-alpine AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=4096
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter ./playground...
RUN pnpm --filter ./playground build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /repo/playground/.output ./.output
# A writable place for the local media driver and file mail, for a quick staging
# run without object storage. It does not survive a redeploy: production uses S3.
RUN mkdir -p /app/data && chown node:node /app/data
ENV NUXT_CMS_STORAGE_LOCAL_DIR=/app/data/uploads NUXT_CMS_MAIL_FILE_DIR=/app/data/mail
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
