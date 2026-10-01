# ── Frontend Dockerfile — multi-stage build ──────────────────────────────────

# ── Stage 1: Build ───────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Copy source and build the Angular app for production
COPY . .
RUN npx ng build --configuration production

# ── Stage 2: Serve ───────────────────────────────────────────────────────────
FROM nginx:1.27-alpine

# Remove default nginx static content
RUN rm -rf /usr/share/nginx/html/*

# Copy the Angular build output
COPY --from=builder /app/dist/frontend/browser /usr/share/nginx/html

# nginx config that supports Angular's HTML5 routing (pushState)
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
