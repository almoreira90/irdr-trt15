# Precedentes IRDR — TRT 15ª Região

Site não oficial que espelha, de forma limpa e pesquisável, as teses jurídicas
fixadas em Incidentes de Resolução de Demandas Repetitivas (IRDR) do TRT da 15ª
Região — coletadas automaticamente do sistema oficial de Gestão de Precedentes
(PJe) e atualizadas diariamente.

## Estrutura

- `scraper/` — coletor em Python + Playwright que navega o sistema oficial
  (`precedentesWeb`), identifica os temas já decididos e extrai apenas os que
  têm **tese firmada** (descarta os extintos/não admitidos sem tese).
- `site/` — site estático (HTML/CSS/JS puro, sem build) que lê `data.json` e
  apresenta os precedentes com busca e exportação em PDF (via jsPDF,
  vendorizado localmente em `site/vendor/`, sem dependência de CDN).
- `.github/workflows/update.yml` — roda o coletor todo dia, commita o
  `data.json` atualizado e publica o site no GitHub Pages.

## Rodar localmente

```bash
cd scraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python scrape.py
```

Isso gera/atualiza `site/data.json`. Para visualizar o site:

```bash
cd site
python3 -m http.server 8000
```

Depois acesse http://localhost:8000

## Nota de transparência

Este site não é mantido pelo TRT da 15ª Região. Em caso de qualquer
divergência, prevalece o inteiro teor do acórdão oficial, acessível pelo link
em cada precedente.

## Autoria

Desenvolvido por André Luiz Moreira Santos — Analista Judiciário do Tribunal
Regional do Trabalho da 15ª Região.
