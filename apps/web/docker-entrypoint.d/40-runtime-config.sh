#!/bin/sh
set -eu

config_file=/usr/share/nginx/html/config.js

keys="VITE_PRIVY_APP_ID VITE_ARC_RPC_URL VITE_USDC_ADDRESS VITE_ESCROW_ADDRESS VITE_DEV_USER_ID VITE_DEV_WALLET VITE_DEV_EMAIL"

{
  printf 'window.__SPLITHAPPENS_CONFIG__ = {\n'
  for key in $keys; do
    value=$(printenv "$key" || true)
    escaped=$(printf '%s' "$value" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
    printf '  %s: "%s",\n' "$key" "$escaped"
  done
  printf '};\n'
} > "$config_file"
