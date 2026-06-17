# syntax=docker/dockerfile:1

# --- Build stage: compile the Vite app to static assets ---
FROM node:22-alpine AS build
WORKDIR /app

# Install dependencies against the lockfile for reproducible builds
COPY package.json package-lock.json ./
RUN npm ci

# Build the production bundle
COPY . .
RUN npm run build

# --- Runtime stage: serve the static assets with nginx ---
FROM nginx:1.27-alpine AS runtime

# SPA-aware nginx config (history fallback + asset caching)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Static build output
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
