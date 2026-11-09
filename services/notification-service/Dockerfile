# syntax=docker/dockerfile:1.7
# ---------------------------------------------------------------------------
# Notification Service — multi-stage, non-root, production image.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=24

FROM node:${NODE_VERSION}-alpine AS base
ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false
WORKDIR /app
RUN apk add --no-cache tini

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM deps AS build
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN npm run build

FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund \
    && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production \
    NOTIFICATION_PORT=3003

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node templates ./templates
COPY --chown=node:node docker/entrypoint.sh ./docker/entrypoint.sh

RUN chmod +x ./docker/entrypoint.sh

USER node
EXPOSE 3003

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./docker/entrypoint.sh"]
