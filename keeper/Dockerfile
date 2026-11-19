# Keeper on Pushbase or any container host. Keeper is a workspace member (it reads
# tinyzoo's types), so the build runs from the repo root with this file as the root
# Dockerfile (Pushbase's "dockerfile" preset).
#
# Runtime: .output and the SQL migrations, applied when the server starts.
FROM node:24-alpine AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=4096
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter ./keeper...
RUN pnpm --filter ./keeper build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_MIGRATIONS_DIR=/app/migrations
COPY --from=build /repo/keeper/.output ./.output
COPY --from=build /repo/keeper/server/db/migrations ./migrations
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
