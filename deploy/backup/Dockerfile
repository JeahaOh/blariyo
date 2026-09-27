# syntax=docker/dockerfile:1
ARG TARGETARCH
FROM scratch AS age-amd64
ADD --checksum=sha256:cbe24006683f8eb669266162894b9a522a1af52f2665fbc63a4bb032ed26ac10 https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-amd64.tar.gz /age.tar.gz
FROM scratch AS age-arm64
ADD --checksum=sha256:6b8dc4333c53a5a57c9e5834e3a48f92605d7154014cd07269ff3327db5d37f4 https://github.com/FiloSottile/age/releases/download/v1.3.2/age-v1.3.2-linux-arm64.tar.gz /age.tar.gz
FROM age-${TARGETARCH} AS age-release
FROM node:24.18.0-bookworm-slim AS dependencies
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund
FROM postgres:18@sha256:4ef4dbc939d61acea57712655ddb4b4ab27419c913f94cca0cd57cb3ea3c2280
COPY --from=dependencies /usr/local/bin/node /usr/local/bin/node
COPY --from=dependencies /app/node_modules /app/node_modules
COPY --from=age-release /age.tar.gz /tmp/age.tar.gz
RUN tar -xzf /tmp/age.tar.gz -C /tmp && cp /tmp/age/age /usr/local/bin/age && rm -rf /tmp/age /tmp/age.tar.gz
WORKDIR /app
COPY deploy/backup/*.mjs /app/backup/
USER 65532:65532
ENTRYPOINT ["node", "/app/backup/backup-runner.mjs"]
CMD ["check"]
