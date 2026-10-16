# syntax=docker/dockerfile:1

# Production image, built by CI (.github/workflows/deploy.yml). One image runs:
#   the app:         node server.js (default)
#   migrations:      node scripts/migrate.cjs
#   test data:       node scripts/seed.cjs [count]

FROM node:24.22.0-alpine3.24 AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# Same pnpm version as "packageManager" in package.json
RUN npm install --global "pnpm@$(node -p 'require("./package.json").packageManager.split("@")[1]')" \
 && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build && pnpm build:scripts

FROM base AS runner
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000
# Standalone server: only the files the app needs, not the whole node_modules.
# The node user owns .next so the server can write its runtime cache there.
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build /app/dist/scripts ./scripts
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
CMD ["node", "server.js"]
