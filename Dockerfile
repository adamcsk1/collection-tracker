# Runtime image that serves the built Angular app with Nginx and runs the built Node.js server
FROM node:20-alpine AS runtime

# Install Nginx, bash (for scripts) and su-exec (to drop privileges at runtime)
RUN apk add --no-cache nginx bash su-exec

# Copy pre-built artifacts produced outside of Docker (nx build ...)
# - Angular client build -> dist/apps/client/browser
# - Node server build   -> dist/apps/server (with generated package.json)
COPY dist/apps/client/browser/ /usr/share/nginx/html/
COPY dist/apps/server/ /app/server/

# Install server production dependencies if package.json is present
WORKDIR /app/server
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; \
  elif [ -f package.json ]; then npm install --omit=dev; \
  else echo "No package.json in server dist. Ensure Nx 'generatePackageJson' is enabled." && exit 1; fi

# Create non-root user and required folders
RUN addgroup -S app && adduser -S app -G app && \
  mkdir -p /data && \
  chown -R app:app \
    /app \
    /data

# Copy Nginx config and startup scripts
WORKDIR /app
COPY docker/nginx.conf /etc/nginx/nginx.conf
COPY docker/start.sh /app/start.sh
COPY docker/entrypoint.sh /app/entrypoint.sh
# Normalize line endings (Windows -> Unix) and make executable
RUN sed -i 's/\r$//' /app/start.sh /app/entrypoint.sh && chmod +x /app/start.sh /app/entrypoint.sh

# Default environment (can be overridden at runtime)
ENV NODE_ENV=production \
  HOST=0.0.0.0 \
  PORT=3000 \
  CORS_ORIGIN=*

# Use a high port so Nginx can bind without root
EXPOSE 3001

# Keep container default user as root so we can fix ownership/permissions of mounted volumes,
# then drop to the non-root 'app' user within the entrypoint.
USER root

# Start entrypoint that will chown/chmod and then exec start.sh as 'app'
ENTRYPOINT ["/app/entrypoint.sh"]
