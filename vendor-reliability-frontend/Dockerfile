# =========================================================================
# Stage 1: Build the Angular Application
# =========================================================================
FROM node:22-alpine AS build

WORKDIR /app

# Copy dependency specifications
COPY package*.json ./

# Install npm dependencies
RUN npm ci

# Copy full application source code
COPY . .

# Build production bundle with optimized configuration
RUN npm run build

# =========================================================================
# Stage 2: Production Nginx Server
# =========================================================================
FROM nginx:alpine

# Remove default nginx static assets
RUN rm -rf /usr/share/nginx/html/*

# Copy built browser bundle from build stage
COPY --from=build /app/dist/vendor-reliability-frontend/browser /usr/share/nginx/html

# Copy custom Nginx configuration with reverse proxy and SPA routing
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port 80
EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
