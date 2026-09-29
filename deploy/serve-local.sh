#!/usr/bin/env bash
# Serve dist/ through the production Caddyfile over plain HTTP, mirroring the VM's
# layout (a current release plus the shared immutable directory). Used by CI;
# also works locally with Caddy installed. Stop it with `caddy stop`.
#
#   deploy/serve-local.sh   ->  http://127.0.0.1:8080 (site), http://localhost:8081 (www)
set -euo pipefail

cd "$(dirname "$0")/.."
[[ -f dist/site.caddy ]] || { echo 'Run npm run build:site first' >&2; exit 1; }
work=$(mktemp -d)
mkdir -p "$work/site" "$work/config"
ln -s "$PWD/dist" "$work/site/current"
ln -s "$PWD/dist/immutable" "$work/site/immutable"
: > "$work/config/origin-tls.caddy"
echo 'trusted_proxies static private_ranges' > "$work/config/cloudflare-proxies.caddy"

CADDY_CONFIG_DIR=$work/config SITE_ROOT=$work/site SITE_LOG=$work/access.log \
  SITE_ADDRESS=http://127.0.0.1:8080 WWW_ADDRESS=http://localhost:8081 \
  caddy start --config deploy/Caddyfile --adapter caddyfile
echo "Serving dist/ through deploy/Caddyfile at http://127.0.0.1:8080 (logs: $work/access.log)"
