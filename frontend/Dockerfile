FROM node:26-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace frontend --include-workspace-root
COPY frontend frontend
RUN npm run build --workspace frontend

FROM nginxinc/nginx-unprivileged:1.31-alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
