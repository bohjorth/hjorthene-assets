#!/usr/bin/env bash
# Automatisk backup af Hjorthene Assets - database + uploads.
# Køres af systemd-timeren hjorthene-assets-backup.timer (se nginx/-mappen).
#
# Kan også køres manuelt til test:
#   /opt/hjorthene-assets/scripts/backup.sh

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_FILE="$APP_DIR/backend/data/hjorthene.db"
UPLOADS_DIR="$APP_DIR/backend/uploads"
BACKUP_DIR="$APP_DIR/backend/data/backups"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"

echo "[$STAMP] Starter backup..."

# Database: brug sqlite3 .backup for et konsistent snapshot (sikkert selvom
# databasen er i brug samtidig), fald tilbage til almindelig filkopi hvis
# sqlite3-CLI'en ikke er installeret.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '$BACKUP_DIR/hjorthene-$STAMP.db'"
else
  cp "$DB_FILE" "$BACKUP_DIR/hjorthene-$STAMP.db"
fi
echo "  - Database gemt: hjorthene-$STAMP.db"

# Uploads-mappe som komprimeret tar. Kan blive stor over tid - thumbnails
# regenereres automatisk ved næste upload af samme fil, så de kan i princippet
# udelades for at spare plads (se evt. --exclude nedenfor).
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$APP_DIR/backend" uploads
echo "  - Uploads gemt: uploads-$STAMP.tar.gz"

# Ryd op i backups ældre end retention-perioden
DELETED=$(find "$BACKUP_DIR" -type f \( -name "hjorthene-*.db" -o -name "uploads-*.tar.gz" \) -mtime +"$RETENTION_DAYS" -print -delete | wc -l)
echo "  - Ryddet op i $DELETED gamle backup-fil(er) (ældre end $RETENTION_DAYS dage)"

echo "[$STAMP] Backup fuldført."
