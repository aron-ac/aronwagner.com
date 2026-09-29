  sudo systemctl reload caddy || true
  rm -rf -- "releases/$release"
  echo "Caddy rejected release $release; restored $previous." >&2#!/usr/bin/env bash
# Publish dist/ to the VM as a new release, then switch to it atomically.
#
#   DEPLOY_HOST=<vm> deploy/deploy.sh   (run `npm run build:site` first)
#
# DEPLOY_SSH_KEY_FILE selects a key other than your SSH defaults.
#
# Fingerprinted assets are added to a shared directory and never deleted, so pages
# that are already open keep working. If Caddy rejects the new release's rules,
# the previous release is restored.
set -euo pipefail

host=${DEPLOY_HOST:?Set DEPLOY_HOST to the VM address}
target="${DEPLOY_USER:-deploy}@$host"
site_root=/srv/aronwagner.com
cd "$(dirname "$0")/.."
release="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short=12 HEAD)"
[[ -f dist/site.caddy ]] || { echo 'dist/ is missing or stale; run npm run build:site' >&2; exit 1; }

ssh_cmd=(ssh -o BatchMode=yes)
if [[ -n ${DEPLOY_SSH_KEY_FILE:-} ]]; then
  ssh_cmd+=(-o IdentitiesOnly=yes -i "$DEPLOY_SSH_KEY_FILE")
fi
rsync_opts=(--rsh "${ssh_cmd[*]}" --recursive --links --times --compress)
rsync "${rsync_opts[@]}" dist/immutable/ "$target:$site_root/immutable/"
rsync "${rsync_opts[@]}" --exclude /immutable/ dist/ "$target:$site_root/releases/$release/"

"${ssh_cmd[@]}" "$target" bash -s -- "$site_root" "$release" <<'REMOTE'
set -euo pipefail
site_root=$1 release=$2
cd "$site_root"
switch() { ln -sfn "releases/$1" current.next && mv -T current.next current; }
previous=$(basename "$(readlink current)")
switch "$release"
if ! sudo systemctl reload caddy; then
  switch "$previous"
  sudo systemctl reload caddy || true
  rm -rf -- "releases/$release"
  echo "Caddy rejected release $release; restored $previous." >&2
  exit 1
fi
# Keep the five newest releases; release names sort by time.
ls -1 releases | grep -v '^empty$' | sort | head -n -5 | sed 's|^|releases/|' | xargs -r rm -rf --
echo "Released $release."
REMOTE
