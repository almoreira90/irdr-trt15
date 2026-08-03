#!/bin/bash
# Roda a coleta local (o WAF do TRT15 bloqueia os runners do GitHub Actions
# por faixa de IP, então isso precisa rodar de uma rede "normal", como este
# computador) e envia o site atualizado para o GitHub, o que dispara a
# publicação automática no GitHub Pages.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$REPO_DIR/scraper/atualizacao.log"

{
  echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="

  "$REPO_DIR/scraper/venv/bin/python3" "$REPO_DIR/scraper/scrape.py"

  cd "$REPO_DIR"
  git add site/data.json

  if git diff --cached --quiet; then
    echo "Sem mudanças nos precedentes."
  else
    git commit -m "chore: atualiza precedentes IRDR ($(date '+%Y-%m-%d'))"
    git push
    echo "Publicado."
  fi

  echo
} >> "$LOG_FILE" 2>&1
