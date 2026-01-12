# syntax=docker/dockerfile:1

FROM node:20-alpine AS build
WORKDIR /app

# pnpm via corepack
RUN corepack enable

COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY ui/package.json ui/tsconfig.json ui/vite.config.ts ui/index.html ./ui/
COPY plc-engine/package.json plc-engine/tsconfig.json plc-engine/vitest.config.ts ./plc-engine/
COPY ladder-types/package.json ladder-types/tsconfig.json ./ladder-types/
COPY server/package.json server/tsconfig.json ./server/

# Install deps (lockfile recommended; if present it will be used)
COPY pnpm-lock.yaml ./
RUN pnpm install

# Copy source
COPY ui ./ui
COPY plc-engine ./plc-engine
COPY ladder-types ./ladder-types
COPY server ./server

RUN pnpm -r build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

RUN corepack enable

COPY package.json pnpm-workspace.yaml ./
COPY server/package.json ./server/package.json
COPY pnpm-lock.yaml ./
RUN pnpm install --prod --filter @plc-sim/server...

COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/ui/dist ./ui/dist

EXPOSE 3000
CMD ["pnpm", "--filter", "@plc-sim/server", "start"]
