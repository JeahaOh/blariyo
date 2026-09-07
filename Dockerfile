FROM node:24.18.0-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --no-audit --no-fund
COPY apps apps
COPY packages packages
COPY scripts scripts
COPY docs/development-specs/m0-core/openapi docs/development-specs/m0-core/openapi
RUN npm run build
FROM node:24.18.0-bookworm-slim AS web
WORKDIR /app
COPY --from=build /app/apps/web/.output ./
USER node
CMD ["node","server/index.mjs"]
FROM node:24.18.0-bookworm-slim AS api
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/apps/api apps/api
COPY --from=build --chown=node:node /app/packages packages
COPY --from=build --chown=node:node /app/package.json package.json
RUN mkdir -p /app/.local-data && chown node:node /app/.local-data
USER node
CMD ["node","apps/api/src/index.mjs"]
