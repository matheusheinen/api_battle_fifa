#!/usr/bin/env bash
# Instala e sobe a API numa VM Ubuntu/Debian SEM Docker.
# Uso (na pasta do projeto):  sudo env PORT=3000 API_KEY=minha-chave bash setup-vm.sh
set -euo pipefail
cd "$(dirname "$0")"
APP_DIR="$(pwd)"
PORT="${PORT:-3000}"
API_KEY="${API_KEY:-fifa-battle-2026}"
AUTH_MODE="${AUTH_MODE:-write}"
# Evita telas interativas do apt/needrestart no Ubuntu
export DEBIAN_FRONTEND=noninteractive NEEDRESTART_MODE=a

echo ">> Pacotes (PostgreSQL + Node 22)"
apt-get update -y
apt-get install -y postgresql curl ca-certificates
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi
systemctl enable --now postgresql

echo ">> Banco"
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='fifa'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE USER fifa WITH PASSWORD 'fifa'"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='fifa'" | grep -q 1 \
  || sudo -u postgres psql -c "CREATE DATABASE fifa OWNER fifa"

echo ">> Dependências + carga em lote"
npm ci --omit=dev
PGHOST=127.0.0.1 node scripts/seed.js

echo ">> Serviço systemd"
cat > /etc/systemd/system/fifa-api.service <<EOF
[Unit]
Description=API Battle FIFA
After=network.target postgresql.service

[Service]
WorkingDirectory=${APP_DIR}
Environment=PORT=${PORT}
Environment=PGHOST=127.0.0.1
Environment=API_KEY=${API_KEY}
Environment=AUTH_MODE=${AUTH_MODE}
Environment=NODE_ENV=production
ExecStart=$(command -v node) src/server.js
Restart=always
RestartSec=1
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now fifa-api
systemctl restart fifa-api
sleep 2
command -v ufw >/dev/null && ufw allow "${PORT}/tcp" || true
curl -s "http://127.0.0.1:${PORT}/fifa/count" && echo
echo ">> Pronto: http://$(hostname -I | awk '{print $1}'):${PORT}/fifa  | docs: /docs"
