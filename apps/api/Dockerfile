FROM node:22-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile --filter "@splitstream/api..."
RUN pnpm --filter @splitstream/api exec prisma generate
RUN pnpm --filter "@splitstream/api..." build

FROM base AS runtime
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/apps/api ./apps/api
EXPOSE 4000
CMD ["sh", "-c", "pnpm --filter @splitstream/api db:migrate && pnpm --filter @splitstream/api start"]
