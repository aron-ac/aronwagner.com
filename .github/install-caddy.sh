#!/usr/bin/env bash
# Install Caddy from its official repository on a GitHub-hosted Ubuntu runner.
set -euo pipefail

curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
  sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt |
  sudo tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
sudo apt-get update -qq
sudo apt-get install -y -qq caddy
# The package starts a system Caddy that holds the admin port; tests run their own.
sudo systemctl stop caddy
