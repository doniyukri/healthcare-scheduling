# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Auth Service — multi-stage, non-root, production image.
#
# Stage graph:
#   deps      installs the full dependency tree (compilers available)
#   build     generates the Prisma client and compiles TypeScript
#   prod-deps installs runtime dependencies only
#   runtime   minimal image: dist, runtime deps, schema and migrations
# ---------------------------------------------------------------------------

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
WORKDIR /app
# tini reaps zombie processes and forwards signals so Nest shuts down cleanly.
RUN apk add --no-cache tini openssl

# ---------------------------------------------------------------------------
FROM base AS deps
# Native modules (bcrypt) and Prisma engines need a toolchain at install time.
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.json nest-cli.json prisma.config.ts ./
COPY prisma ./prisma
RUN npx prisma generate
COPY src ./src
RUN npm run build

# ---------------------------------------------------------------------------
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

# ---------------------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production \
    AUTH_PORT=3001

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json prisma.config.ts ./
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

USER node
EXPOSE 3001

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker/entrypoint.sh"]
