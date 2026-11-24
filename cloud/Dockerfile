# The tinyzoo account service on Pushbase or any container host: the cloud app with
# NUXT_HOSTING_DRIVER=none. People have their account here, websites that run elsewhere
# are connected to it and sign their people in through it. No website is made by this
# image: it carries no template and writes nothing to disk.
#
# The app is a workspace member, so the build runs from the repo root:
# `node scripts/deploy-site.mjs <project> --dockerfile cloud/Dockerfile --without templates`
# uploads the repo with this file as its root Dockerfile (Pushbase's "dockerfile" preset).
#
# Runtime: only .output ships. The migrations are bundled and applied at start.
# See cloud/README.md ("Deploying the account service") for the environment.
FROM node:22-alpine AS build
WORKDIR /repo
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0 NODE_OPTIONS=--max-old-space-size=4096
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter ./cloud...
RUN pnpm --filter ./cloud build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 NUXT_HOSTING_DRIVER=none
COPY --from=build /repo/cloud/.output ./.output
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
