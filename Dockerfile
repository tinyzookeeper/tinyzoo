# Staging deploy of the playground (the demo site + admin) on Pushbase, or any
# container host. The playground lives in a workspace subfolder, so the build runs
# from the repo root (Pushbase's "dockerfile" preset picks this file up).
#
# Runtime: only .output ships. Migrations are bundled and applied at start when
# NUXT_CMS_MIGRATIONS_ON_START=true. See docs/deploying.md for the environment.
FROM node:22-alpine AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=4096 CMS_DB_DRIVER=node
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter ./playground...
RUN pnpm --filter ./playground build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000
COPY --from=build /repo/playground/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
