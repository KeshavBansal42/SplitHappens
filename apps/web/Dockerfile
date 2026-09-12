FROM node:22-slim AS build
RUN corepack enable
WORKDIR /app

ARG VITE_PRIVY_APP_ID=
ARG VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
ARG VITE_USDC_ADDRESS=
ARG VITE_ESCROW_ADDRESS=
ARG VITE_DEV_USER_ID=
ARG VITE_DEV_WALLET=
ARG VITE_DEV_EMAIL=
ENV VITE_PRIVY_APP_ID=$VITE_PRIVY_APP_ID \
    VITE_ARC_RPC_URL=$VITE_ARC_RPC_URL \
    VITE_USDC_ADDRESS=$VITE_USDC_ADDRESS \
    VITE_ESCROW_ADDRESS=$VITE_ESCROW_ADDRESS \
    VITE_DEV_USER_ID=$VITE_DEV_USER_ID \
    VITE_DEV_WALLET=$VITE_DEV_WALLET \
    VITE_DEV_EMAIL=$VITE_DEV_EMAIL

COPY . .
RUN pnpm install --frozen-lockfile --filter "@splithappens/web..."
RUN pnpm --filter "@splithappens/web..." build

FROM nginx:1.27-alpine
ENV PORT=80 \
    API_UPSTREAM=http://api:4000
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY apps/web/docker-entrypoint.d/40-runtime-config.sh /docker-entrypoint.d/40-runtime-config.sh
RUN chmod +x /docker-entrypoint.d/40-runtime-config.sh
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
