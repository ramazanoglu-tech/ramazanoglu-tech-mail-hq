# Build context is the REPOSITORY ROOT (see docker-compose.yml) so the PWA can be copied in.

FROM node:26-alpine AS builder

WORKDIR /app
COPY cloud-backend/package*.json cloud-backend/tsconfig.json ./
RUN npm ci

COPY cloud-backend/src ./src
RUN npm run build

FROM node:26-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY cloud-backend/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY cloud-backend/schema.sql ./
# index.ts serves ../mobile-pwa/public relative to the working dir (/app) => /mobile-pwa/public
COPY mobile-pwa/public /mobile-pwa/public

EXPOSE 8765

# Run as the unprivileged user shipped with the node image, not root
USER node

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8765/api/health || exit 1

CMD ["node", "dist/index.js"]
