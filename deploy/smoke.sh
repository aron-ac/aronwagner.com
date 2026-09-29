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
check 'old game redirect keeps query' '/cr-surf-rides.html?debug=1' '^location: /surf-riders.html\?debug=1$'
check 'stable asset alias' /favicon.ico '^location: /immutable/[0-9a-f]+/favicon.ico$'
immutable=$(curl ${curl_opts[@]+"${curl_opts[@]}"} -sS -o /dev/null -D - --max-time 20 "$base/favicon.ico" | tr -d '\r' |
  sed -n 's/^[Ll]ocation: //p')
check 'immutable caching' "$immutable" '^cache-control: public, max-age=31536000, immutable'
for hidden in /site.caddy /_headers /_redirects; do
  check "hides $hidden" "$hidden" '^HTTP/[0-9.]+ 404'
done
if [[ -n $www ]]; then
  base=${www%/}
  check 'www redirect' '/surf-riders.html?x=1' \
    '^location: https://aronwagner.com/surf-riders.html\?x=1$'
fi

if ((failures)); then
  echo "$failures check(s) failed." >&2
  exit 1
fi
echo 'All response checks passed.'
