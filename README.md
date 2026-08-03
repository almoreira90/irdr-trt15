# Precedentes IRDR — TRT 15ª Região

Site não oficial que espelha, de forma limpa e pesquisável, as teses jurídicas
fixadas em Incidentes de Resolução de Demandas Repetitivas (IRDR) do TRT da 15ª
Região — coletadas do sistema oficial de Gestão de Precedentes (PJe) e
atualizadas diariamente.

## Estrutura

- `scraper/` — coletor em Python + Playwright que navega o sistema oficial
  (`precedentesWeb`), identifica os temas já decididos e extrai apenas os que
  têm **tese firmada** (descarta os extintos/não admitidos/rejeitados sem tese).
- `site/` — site estático (HTML/CSS/JS puro, sem build) que lê `data.json` e
  apresenta os precedentes com busca e exportação em PDF (via jsPDF,
  vendorizado localmente em `site/vendor/`, sem dependência de CDN).
- `.github/workflows/update.yml` — publica o site no GitHub Pages sempre que
  `site/` muda no branch `main`. **Não roda o coletor** (veja a nota abaixo).

## Por que a coleta roda localmente, e não no GitHub Actions

O WAF do TRT15 bloqueia por faixa de IP as requisições vindas dos runners de
nuvem do GitHub Actions (confirmado: HTTP 403 mesmo enviando um User-Agent de
navegador legítimo). Por isso a coleta roda numa máquina "normal" — neste caso,
agendada localmente via `launchd` — e só o resultado (`site/data.json`) é
enviado ao GitHub, o que dispara a publicação automática no Pages.

- `scraper/atualizar_e_publicar.sh` — roda o coletor e, se algo mudou, commita
  e envia `site/data.json`.
- `~/Library/LaunchAgents/br.jus.trt15.irdr.update.plist` — agenda esse script
  todos os dias às 7h (horário local). Para checar/alterar:
  ```bash
  launchctl print gui/$(id -u)/br.jus.trt15.irdr.update   # ver status
  launchctl bootout gui/$(id -u)/br.jus.trt15.irdr.update # desativar
  ```
  O log de cada execução fica em `scraper/atualizacao.log`. **Importante**:
  a atualização diária só acontece se este computador estiver ligado e
  conectado à internet no horário agendado.

## Rodar a coleta manualmente

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
