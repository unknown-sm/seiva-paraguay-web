#!/usr/bin/env bash
# Backup diario de la BD de produccion de la tienda hacia esta maquina.
# Credenciales en ~/.zcode/seiva-backup.env (PROD_URL, PROD_ADMIN_PASSWORD).
# Uso manual: bash /e/Pagina_seiva/tools/backup-prod.sh
set -euo pipefail

ENV_FILE="$HOME/.zcode/seiva-backup.env"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
: "${PROD_URL:?Falta PROD_URL en $ENV_FILE}"
: "${PROD_ADMIN_PASSWORD:?Falta PROD_ADMIN_PASSWORD en $ENV_FILE}"

DEST_DIR="${SEIVA_BACKUP_DIR:-/e/Pagina_seiva/backups-prod}"
KEEP="${SEIVA_BACKUP_KEEP:-14}"
mkdir -p "$DEST_DIR"

# Login (token JWT de 24h; se pide en cada corrida).
# Si PROD_ADMIN_USER está definido, usa login usuario+contraseña;
# si no, el login clásico por contraseña de admin.
export SEIVA_PW="$PROD_ADMIN_PASSWORD"
export SEIVA_USER="${PROD_ADMIN_USER:-}"
LOGIN_BODY=$(node -e 'console.log(JSON.stringify(process.env.SEIVA_USER ? {username:process.env.SEIVA_USER, password:process.env.SEIVA_PW} : {password:process.env.SEIVA_PW}))')
TOKEN=$(curl -sSf -X POST "$PROD_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "$LOGIN_BODY" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{try{console.log(JSON.parse(d).token||'')}catch(e){console.log('')}})")
[ -n "$TOKEN" ] || { echo "[backup-prod] ERROR: login fallo contra $PROD_URL"; exit 1; }

OUT="$DEST_DIR/seiva-db-$(date +%Y-%m-%d_%H%M).sqlite"
curl -sSf -H "Authorization: Bearer $TOKEN" -o "$OUT.part" "$PROD_URL/api/admin/db-backup"
mv "$OUT.part" "$OUT"

# Verificar integridad del snapshot
node -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(process.argv[1], { readOnly: true });
const r = db.prepare('PRAGMA quick_check').get();
if (!r || r.quick_check !== 'ok') { console.error('[backup-prod] ERROR quick_check: ' + (r && r.quick_check)); process.exit(1); }
const prods = db.prepare('SELECT COUNT(*) c FROM productos').get().c;
console.log('[backup-prod] OK: ' + process.argv[1] + ' (' + prods + ' productos)');
" "$OUT"

# Rotacion: conservar los KEEP mas recientes
ls -1t "$DEST_DIR"/seiva-db-*.sqlite 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r f; do
  rm -f "$f"
  echo "[backup-prod] rotado: $f"
done
