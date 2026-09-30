#!/usr/bin/env bash
# Keep the VM's HTTPS allowlist and Caddy's trusted proxies in step with Cloudflare's
# published IP ranges. Installed by provision.sh as a weekly systemd timer; run as root.
#
# The firewall is updated by difference (add new ranges, then remove stale ones) and
# never reset, so HTTPS is never briefly open or closed. If Cloudflare's lists can't
# be fetched or look incomplete, nothing changes.
set -euo pipefail

config=${CADDY_CONFIG_DIR:-/etc/caddy}
ipv4=$(curl -fsS --max-time 30 https://www.cloudflare.com/ips-v4)
ipv6=$(curl -fsS --max-time 30 https://www.cloudflare.com/ips-v6)
cidr='^[0-9a-f:.]+/[0-9]+$'
if (($(grep -cE "$cidr" <<< "$ipv4") < 10 || $(grep -cE "$cidr" <<< "$ipv6") < 5)); then
  echo 'Cloudflare IP lists look incomplete; leaving the firewall unchanged.' >&2
  exit 1
fi
wanted=$(printf '%s\n%s\n' "$ipv4" "$ipv6" | grep -E "$cidr" | sort -u)

# Current HTTPS allow rules, e.g. "443/tcp (v6)   ALLOW   2400:cb00::/32".
current=$(ufw status | awk '$1 == "443/tcp" && ($2 == "ALLOW" || $3 == "ALLOW") { print $NF }' | sort -u)
added=0 removed=0
while read -r range; do
  [[ -n $range ]] || continue
  ufw allow proto tcp from "$range" to any port 443 > /dev/null
  added=$((added + 1))
done < <(comm -13 <(printf '%s\n' "$current") <(printf '%s\n' "$wanted"))
while read -r range; do
  [[ -n $range ]] || continue
  ufw delete allow proto tcp from "$range" to any port 443 > /dev/null
  removed=$((removed + 1))
done < <(comm -23 <(printf '%s\n' "$current") <(printf '%s\n' "$wanted"))

proxies="trusted_proxies static $(tr '\n' ' ' <<< "$wanted")"
if [[ "$(cat "$config/cloudflare-proxies.caddy" 2> /dev/null)" != "$proxies" ]]; then
  printf '%s\n' "$proxies" > "$config/cloudflare-proxies.caddy"
  if systemctl is-active --quiet caddy; then systemctl reload caddy; fi
  echo 'Updated Caddy trusted proxies.'
fi
echo "Cloudflare ranges: $(wc -l <<< "$wanted" | tr -d ' ') allowed on 443 ($added added, $removed removed)."
