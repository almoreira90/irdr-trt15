async function main() {
  const lista = document.getElementById("lista");
  const busca = document.getElementById("busca");
  const meta = document.getElementById("meta");
  const vazio = document.getElementById("vazio");
  const atualizado = document.getElementById("atualizado");
  const btnPdf = document.getElementById("btnPdf");

  let dados;
  try {
    const resp = await fetch("data.json", { cache: "no-store" });
    dados = await resp.json();
  } catch (e) {
    lista.innerHTML = "<p>Não foi possível carregar os precedentes agora. Tente novamente mais tarde.</p>";
    return;
  }

  const irdrs = dados.irdrs || [];

  if (dados.atualizado_em) {
    const dt = new Date(dados.atualizado_em);
    atualizado.textContent = `Última atualização: ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR")}`;
  }

  function render(items) {
    lista.innerHTML = "";
    vazio.hidden = items.length > 0;
    meta.textContent = `${items.length} de ${irdrs.length} precedente${irdrs.length === 1 ? "" : "s"}`;

    for (const item of items) {
      const card = document.createElement("article");
      card.className = "card";

      card.innerHTML = `
        <div class="card-header">
          <span class="card-numero">IRDR ${escapeHtml(item.numero)}</span>
          <span class="badge">${escapeHtml(item.situacao_label || "Decidido")}</span>
        </div>
        <p class="card-descricao">${escapeHtml(item.descricao || "")}</p>
        <div class="card-tese">
          <span class="card-tese-label">Tese firmada</span>
          ${escapeHtml(item.tese || "")}
        </div>
        <div class="card-footer">
          ${item.transito_julgado ? `<span>Trânsito em julgado: ${escapeHtml(item.transito_julgado)}</span>` : ""}
          ${item.data_julgamento ? `<span>Julgado em: ${escapeHtml(item.data_julgamento)}</span>` : ""}
          ${item.link_processo ? `<a href="${escapeAttr(item.link_processo)}" target="_blank" rel="noopener">Ver acórdão original ↗</a>` : ""}
        </div>
      `;
      lista.appendChild(card);
    }
  }

  function normalizar(texto) {
    return (texto || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function filtrar(termo) {
    const q = normalizar(termo);
    if (!q) return irdrs;
    return irdrs.filter((item) =>
      normalizar(item.numero).includes(q) ||
      normalizar(item.descricao).includes(q) ||
      normalizar(item.tese).includes(q)
    );
  }

  busca.addEventListener("input", () => render(filtrar(busca.value)));

  btnPdf.addEventListener("click", () => {
    btnPdf.disabled = true;
    const textoOriginal = btnPdf.textContent;
    btnPdf.textContent = "Gerando PDF…";
    setTimeout(() => {
      try {
        gerarPdf(irdrs, dados);
      } finally {
        btnPdf.disabled = false;
        btnPdf.textContent = textoOriginal;
      }
    }, 30);
  });

  render(irdrs);
}

function gerarPdf(irdrs, dados) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 48;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - marginX * 2;
  let y = 56;

  function ensureSpace(h) {
    if (y + h > pageHeight - 60) {
      doc.addPage();
      y = 56;
    }
  }

  function texto(str, size, style, color, gapDepois) {
    if (!str) return;
    doc.setFont("helvetica", style || "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(str, maxWidth);
    const lineHeight = size * 1.25;
    ensureSpace(lines.length * lineHeight);
    doc.text(lines, marginX, y);
    y += lines.length * lineHeight + (gapDepois || 0);
  }

  texto("PRECEDENTES IRDR — TRT 15ª REGIÃO", 18, "bold", [20, 40, 65], 6);
  texto(
    "Teses jurídicas vinculantes fixadas em Incidentes de Resolução de Demandas Repetitivas",
    11, "normal", [90, 96, 105], 8
  );
  texto(`Total de precedentes com tese fixada: ${irdrs.length}`, 10, "normal", [90, 96, 105], 2);
  if (dados.atualizado_em) {
    const dt = new Date(dados.atualizado_em);
    texto(
      `Última coleta: ${dt.toLocaleDateString("pt-BR")} às ${dt.toLocaleTimeString("pt-BR")}`,
      10, "normal", [90, 96, 105], 18
    );
  }

  for (const item of irdrs) {
    ensureSpace(30);
    doc.setDrawColor(215, 222, 230);
    doc.line(marginX, y, pageWidth - marginX, y);
    y += 16;

    texto(`IRDR ${item.numero} — ${item.situacao_label || ""}`, 12, "bold", [20, 40, 65], 6);
    texto(item.descricao || "", 10, "normal", [75, 82, 92], 8);
    texto("TESE FIRMADA", 8, "bold", [20, 40, 65], 3);
    texto(item.tese || "", 10, "normal", [23, 27, 34], 8);

    const infoParts = [];
    if (item.data_julgamento) infoParts.push(`Julgado em ${item.data_julgamento}`);
    if (item.transito_julgado) infoParts.push(`Trânsito em julgado ${item.transito_julgado}`);
    if (infoParts.length) texto(infoParts.join("    ·    "), 9, "normal", [130, 136, 144], 4);

    if (item.link_processo) {
      ensureSpace(16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(29, 78, 216);
      doc.textWithLink("Ver acórdão original", marginX, y, { url: item.link_processo });
      y += 20;
    }
    y += 4;
  }

  const totalPaginas = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(140, 146, 154);
    doc.text(
      "Desenvolvido por André Luiz Moreira Santos — Analista Judiciário do Tribunal Regional do Trabalho da 15ª Região",
      marginX, pageHeight - 30
    );
    doc.text(`${p} / ${totalPaginas}`, pageWidth - marginX, pageHeight - 30, { align: "right" });
  }

  doc.save("precedentes-irdr-trt15.pdf");
}

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

main();
