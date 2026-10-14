#!/usr/bin/env bash
set -euo pipefail
# Run as root. This script matches the paths in DEPLOY-LINUX.md.
# It retains every backup; arrange retention after choosing your recovery window.
if [ "$(id -u)" -ne 0 ]; then echo 'Run with sudo.' >&2; exit 1; fi
umask 077
backup_dir="/var/backups/tonghop/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
was_active=0
if systemctl is-active --quiet tonghop-api; then was_active=1; fi
restart_api() { if [ "$was_active" -eq 1 ]; then systemctl start tonghop-api; fi; }
trap restart_api EXIT
if [ "$was_active" -eq 1 ]; then systemctl stop tonghop-api; fi
runuser -u postgres -- pg_dump --format=custom tonghop > "$backup_dir/database.dump"
tar -czf "$backup_dir/files.tar.gz" -C /opt/tong-hop-giai-phap Solutions storage .env
sha256sum "$backup_dir/database.dump" "$backup_dir/files.tar.gz" > "$backup_dir/SHA256SUMS"
echo "Backup saved: $backup_dir"
