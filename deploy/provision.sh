#!/usr/bin/env bash
# Prepare a fresh Ubuntu VM to serve aronwagner.com. Safe to re-run.
#
#   scp deploy/Caddyfile deploy/refresh-cloudflare-ips.sh cloud@<vm>:/tmp/
#   ssh cloud@<vm> sudo bash -s -- "'$(cat deploy_key.pub)'" < deploy/provision.sh
#
# `cloud` is the image's sudo-capable admin user.
set -euo pipefail

deploy_key=${1:?Pass the deploy SSH public key as the first argument}
site_root=/srv/aronwagner.com
config=/etc/caddy
certs=$config/certs
export DEBIAN_FRONTEND=noninteractive

# Caddy's official repository tracks current releases.
apt-get update
apt-get install -y curl gpg rsync ufw unattended-upgrades
if [[ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]]; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key |
    gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
    > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
fi
apt-get install -y caddy

# A deploy user that owns only the site files and may only reload Caddy.
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
printf '%s\n' "$deploy_key" > /home/deploy/.ssh/authorized_keys
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
printf 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl reload caddy\n' > /etc/sudoers.d/deploy
chmod 440 /etc/sudoers.d/deploy
visudo -cf /etc/sudoers.d/deploy

# Key-only SSH.
cat > /etc/ssh/sshd_config.d/10-aronwagner.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
sshd -t
systemctl reload ssh

# Site layout. An empty first release lets Caddy start before the first deploy.
install -d -o deploy -g deploy "$site_root" "$site_root/releases" "$site_root/immutable"
if [[ ! -e $site_root/current ]]; then
  install -d -o deploy -g deploy "$site_root/releases/empty"
  printf '# No release deployed yet.\n' > "$site_root/releases/empty/site.caddy"
  chown deploy:deploy "$site_root/releases/empty/site.caddy"
  ln -s releases/empty "$site_root/current"
  chown -h deploy:deploy "$site_root/current"
fi
install -d -o caddy -g caddy /var/log/caddy
find /var/log/caddy -user root -exec chown caddy:caddy {} +

# Only Cloudflare may reach HTTPS; Caddy trusts its forwarded client address. The
# refresh script keeps both current, and a weekly timer reruns it.
install -m 755 /tmp/refresh-cloudflare-ips.sh /usr/local/sbin/refresh-cloudflare-ips
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
/usr/local/sbin/refresh-cloudflare-ips
ufw --force enable
cat > /etc/systemd/system/refresh-cloudflare-ips.service <<'UNIT'
[Unit]
Description=Refresh the Cloudflare IP allowlist and Caddy trusted proxies
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/refresh-cloudflare-ips
UNIT
cat > /etc/systemd/system/refresh-cloudflare-ips.timer <<'UNIT'
[Unit]
Description=Weekly Cloudflare IP refresh

[Timer]
OnCalendar=weekly
RandomizedDelaySec=6h
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now refresh-cloudflare-ips.timer

# Cloudflare Origin Certificate. Until it is installed, a self-signed stand-in
# lets Caddy start (Cloudflare's Full (strict) mode will reject it).
install -d -m 750 -o root -g caddy "$certs"
if [[ ! -f $certs/aronwagner.com.pem ]]; then
  openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 30 \
    -subj /CN=aronwagner.com -addext 'subjectAltName=DNS:aronwagner.com,DNS:*.aronwagner.com' \
    -keyout "$certs/aronwagner.com.key" -out "$certs/aronwagner.com.pem"
fi
chown root:caddy "$certs"/aronwagner.com.*
chmod 640 "$certs"/aronwagner.com.*
printf 'tls %s/aronwagner.com.pem %s/aronwagner.com.key\n' "$certs" "$certs" > "$config/origin-tls.caddy"

install -m 644 /tmp/Caddyfile "$config/Caddyfile"
# Validate as the service user so any files it opens (such as logs) stay writable.
runuser -u caddy -- caddy validate --config "$config/Caddyfile" --adapter caddyfile
systemctl enable caddy
systemctl reload-or-restart caddy
echo "Provisioned. Caddy $(caddy version | cut -d' ' -f1) is serving $site_root/current."
