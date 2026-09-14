FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace backend --include-workspace-root
COPY backend backend
RUN npm run build --workspace backend && npm prune --omit=dev --workspace backend

FROM node:22-bookworm-slim
ENV NODE_ENV=production PORT=3000
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl && \
    mkdir -p /app/certs && curl --fail --silent --show-error https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem -o /app/certs/rds.pem && \
    apt-get purge -y curl && apt-get autoremove -y && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/backend/package.json ./backend/package.json
COPY --from=build --chown=node:node /app/backend/dist ./backend/dist
COPY --from=build --chown=node:node /app/backend/migrations ./backend/migrations
USER node
EXPOSE 3000
CMD ["node", "backend/dist/server.js"]
