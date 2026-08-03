"""
Coletor de IRDRs (Incidentes de Resolução de Demandas Repetitivas) do sistema
de Gestão de Precedentes do PJe do TRT da 15ª Região.

O sistema oficial (https://pje.trt15.jus.br/precedentesWeb/...) é uma aplicação
JSF/Seam antiga, sem API e sem URL individual por tema: tudo é servido via
AJAX com estado de sessão. Este script usa um navegador real (Playwright) para
navegar exatamente como uma pessoa faria.

Estratégia:
  1. Abre a listagem de temas do tipo IRDR e marca "Exibir os já decididos".
  2. Percorre as páginas da tabela e coleta o número de cada tema marcado
     como "(Decidido)" — só esses podem ter tese fixada.
  3. Para cada um desses números, abre uma sessão nova e navega até o tema
     (mais lento, porém muito mais robusto que tentar "voltar" dentro do
     mesmo estado de AJAX), extraindo os campos da aba "Dados Básicos" e
     da aba "Dados Complementares".
  4. Mantém apenas os temas cujo campo "Tese Firmada" veio preenchido —
     esse é o critério objetivo para excluir IRDRs extintos/não admitidos
     sem tese fixada.

Saída: site/data.json
"""

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

BASE_URL = "https://pje.trt15.jus.br/precedentesWeb/pages/public/TemaLista.seam?tipo=IRDR"
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/17.0 Safari/605.1.15"
)
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "site" / "data.json"
NAV_DELAY = 0.8  # segundos de cortesia entre ações, para não sobrecarregar o servidor do Tribunal

# Às vezes a equipe do NUGEP registra uma justificativa no campo "Tese Firmada"
# mesmo quando nenhuma tese foi de fato fixada (ex.: IRDR rejeitado por falta de
# quórum). Esse padrão captura esses casos para que não sejam publicados como
# se fossem precedentes vinculantes.
REJEICAO_PATTERN = re.compile(
    r"rejeitad[ao]s?\s+(as|a)\s+teses?|ficando rejeitada|não obteve.{0,40}votos|"
    r"nenhuma das teses|rejeitado o presente IRDR",
    re.IGNORECASE,
)


def tese_valida(texto):
    return bool(texto) and not REJEICAO_PATTERN.search(texto)


def check_ja_decididos(page):
    checkbox = page.locator("#checkEncerrados")
    if not checkbox.is_checked():
        checkbox.check()
        page.wait_for_timeout(1500)


def goto_page_n(page, n):
    """Clica nas setas do paginador da tabela até chegar na página n (1-indexado)."""
    for _ in range(n - 1):
        proximo = page.locator("#tabelaTemas\\:dataScroller").get_by_text("»", exact=True)
        proximo.click()
        page.wait_for_timeout(1200)


def collect_decided_numbers(page):
    """Varre todas as páginas da listagem e devolve os números marcados '(Decidido)'."""
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(1000)
    check_ja_decididos(page)

    total_text = page.locator("#totalizador").inner_text()
    m = re.search(r"(\d+)", total_text)
    total = int(m.group(1)) if m else None
    print(f"Total de temas IRDR cadastrados: {total}", file=sys.stderr)

    numbers = []
    current_page = 1
    while True:
        rows = page.locator("#tabelaTemas\\:tb tr")
        count = rows.count()
        for i in range(count):
            link = rows.nth(i).locator("td:nth-child(2) a").first
            text = link.inner_text().strip()
            match = re.match(r"(\d+)\s*(\(Decidido\))?", text)
            if match and match.group(2):
                numbers.append(match.group(1))

        next_btn = page.locator("#tabelaTemas\\:dataScroller").get_by_text("»", exact=True)
        classes = next_btn.get_attribute("class") or ""
        if "dsbld" in classes:
            break
        next_btn.click()
        page.wait_for_timeout(1200)
        current_page += 1

    print(f"Temas marcados como decididos: {len(numbers)}", file=sys.stderr)
    return numbers


def open_tema(page, numero):
    """Reabre a listagem do zero e clica no link do tema com o número dado."""
    page.goto(BASE_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(800)
    check_ja_decididos(page)

    filtro = page.locator("#temaAplicadoAdicionarDecorate\\:temaAplicadoAdicionarInput")
    filtro.fill(numero)
    page.locator("#botaoPesquisa").click()
    page.wait_for_timeout(1200)

    link = page.locator("#tabelaTemas\\:tb tr").first.locator("td:nth-child(2) a").first
    link.click()
    page.wait_for_timeout(1000)


def extract_dados_basicos(page):
    def val(selector):
        try:
            return page.locator(selector).input_value().strip()
        except PWTimeout:
            return ""

    situacao_select = page.locator("#situacaoDecorate\\:situacaoSelect")
    situacao_value = situacao_select.input_value()
    situacao_label = situacao_select.locator(f'option[value="{situacao_value}"]').inner_text()

    return {
        "numero": val("#numeroTemaDecorate\\:numeroTemaInput"),
        "data_admissao": val("#dt_admissaoDecorate\\:dt_admissaoInputInputDate"),
        "data_julgamento": val("#dt_julg1Decorate\\:dt_julg1InputInputDate"),
        "data_publicacao": val("#dt_publicacaoDecorate\\:dt_publicacaoInputInputDate"),
        "transito_julgado": val("#dt_transito1Decorate\\:dt_transito1InputInputDate"),
        "situacao_value": situacao_value,
        "situacao_label": situacao_label,
        "descricao": page.locator("#descTema").input_value().strip(),
        "link_processo": val("#linkDecorate\\:linkInput"),
    }


def extract_dados_complementares(page):
    aba2_tab = page.get_by_text("Dados Complementares", exact=True)
    aba2_tab.click()
    page.wait_for_timeout(800)

    def val(selector):
        try:
            return page.locator(selector).input_value().strip()
        except PWTimeout:
            return ""

    return {
        "tese": val("#tese"),
        "ementa_merito": val("#ementaMerito"),
    }


def scrape_tema(page, numero):
    open_tema(page, numero)
    dados = extract_dados_basicos(page)
    dados.update(extract_dados_complementares(page))
    return dados


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(user_agent=USER_AGENT)
        page = context.new_page()

        decided_numbers = collect_decided_numbers(page)

        resultados = []
        for idx, numero in enumerate(decided_numbers, start=1):
            print(f"[{idx}/{len(decided_numbers)}] tema {numero}", file=sys.stderr)
            try:
                dados = scrape_tema(page, numero)
            except Exception as exc:
                print(f"  erro ao coletar tema {numero}: {exc}", file=sys.stderr)
                continue

            if not tese_valida(dados.get("tese")):
                print(f"  tema {numero}: sem tese firmada válida ({dados.get('situacao_label')}) — descartado", file=sys.stderr)
                continue

            dados["tipo"] = "IRDR"
            resultados.append(dados)
            time.sleep(NAV_DELAY)

        browser.close()

    saida = {
        "atualizado_em": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "fonte": BASE_URL,
        "total_temas_decididos_verificados": len(decided_numbers),
        "total_com_tese_fixada": len(resultados),
        "irdrs": resultados,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(saida, f, ensure_ascii=False, indent=2)

    print(f"\n{len(resultados)} IRDRs com tese fixada salvos em {OUTPUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
