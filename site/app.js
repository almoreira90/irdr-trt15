async function main() {
  const lista = document.getElementById("lista");
  const busca = document.getElementById("busca");
  const meta = document.getElementById("meta");
  const vazio = document.getElementById("vazio");
  const atualizado = document.getElementById("atualizado");

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

  render(irdrs);
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
