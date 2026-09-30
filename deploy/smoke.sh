#!/usr/bin/env bash
# Check a running site's response policies: headers, redirects and hidden files.
#
#   deploy/smoke.sh https://aronwagner.com [https://www.aronwagner.com]
#
# SMOKE_CURL_OPTS adds curl flags, e.g. to test a VM before DNS points at it:
#   SMOKE_CURL_OPTS="--insecure --resolve aronwagner.com:443:<vm-ip>" deploy/smoke.sh ...
set -euo pipefail

base=${1:?Pass the site URL}
base=${base%/}
www=${2:-}
failures=0
read -ra curl_opts <<< "${SMOKE_CURL_OPTS:-}"

check() {
  local description=$1 path=$2 pattern=$3
  local response
  response=$(curl ${curl_opts[@]+"${curl_opts[@]}"} -sS -o /dev/null -D - --max-time 20 "$base$path" | tr -d '\r')
  if grep -qiE "$pattern" <<< "$response"; then
    echo "ok   $description"
  else
    echo "FAIL $description ($path): expected /$pattern/" >&2
    failures=$((failures + 1))
  fi
}

check 'homepage loads' / '^HTTP/[0-9.]+ 200'
check 'content security policy' / "^content-security-policy: default-src 'self'"
check 'framing denied' / '^x-frame-options: DENY'
check 'desk redirect' /desk.html '^location: /$'
check 'old game redirect keeps query' '/cici-treat-trail.html?debug=1' '^location: /maggies-toy-run.html\?debug=1$'
check 'retired game redirect' /surf-riders.html '^location: /$'
check 'stable asset alias' /favicon.ico '^location: /immutable/[0-9a-f]+/favicon.ico$'
immutable=$(curl ${curl_opts[@]+"${curl_opts[@]}"} -sS -o /dev/null -D - --max-time 20 "$base/favicon.ico" | tr -d '\r' |
  sed -n 's/^[Ll]ocation: //p')
check 'immutable caching' "$immutable" '^cache-control: public, max-age=31536000, immutable'
check 'arcade game' /maggies-toy-run.html '^HTTP/[0-9.]+ 200'
check 'second arcade game' /aisle-dash.html '^HTTP/[0-9.]+ 200'
check 'robots.txt' /robots.txt '^HTTP/[0-9.]+ 200'
check 'sitemap' /sitemap.xml '^content-type: (application|text)/xml'
# The 404 page must keep its status and actually be the site's page.
check 'missing page status' /no-such-page '^HTTP/[0-9.]+ 404'
if curl ${curl_opts[@]+"${curl_opts[@]}"} -sS --max-time 20 "$base/no/such/page" | grep -q 'Page not found'; then
  echo "ok   404 page"
else
  echo "FAIL 404 page (/no/such/page): expected the site's Page not found page" >&2
  failures=$((failures + 1))
fi
for hidden in /site.caddy /_headers /_redirects; do
  check "hides $hidden" "$hidden" '^HTTP/[0-9.]+ 404'
done
if [[ -n $www ]]; then
  base=${www%/}
  check 'www redirect' '/maggies-toy-run.html?x=1' \
    '^location: https://aronwagner.com/maggies-toy-run.html\?x=1$'
fi

if ((failures)); then
  echo "$failures check(s) failed." >&2
  exit 1
fi
echo 'All response checks passed.'
