# Stage 1: install everything and build the web app.
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @hrmit/web build

# Stage 2: production dependencies of the server only, plus the built web app.
# The server runs TypeScript directly with tsx (a runtime dependency), like `pnpm start`.
FROM node:24-alpine
RUN corepack enable
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 HRMIT_DATA_DIR=/app/data
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY apps/server/package.json apps/server/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @hrmit/server...
COPY apps/server apps/server
COPY packages/shared packages/shared
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /app/data && chown node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
WORKDIR /app/apps/server
# Not through pnpm: the node user has no corepack cache, and tsx is a direct dependency.
CMD ["node_modules/.bin/tsx", "src/index.ts"]
