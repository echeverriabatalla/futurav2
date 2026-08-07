// Listado de todas las desarrolladoras registradas, cada una con su
// cantidad de proyectos activos (derivada de FUTURA_PROJECTS, no
// hardcodeada) — clic lleva a su landing individual (desarrolladora.html).
(() => {
  const PROJECTS = window.FUTURA_PROJECTS;
  const DEVELOPERS = window.FUTURA_DEVELOPERS;
  const listEl = document.getElementById("developer-list");

  const rows = DEVELOPERS.map((dev) => ({
    dev,
    activeCount: PROJECTS.filter((p) => p.developer.slug === dev.slug).length,
  })).sort((a, b) => a.dev.name.localeCompare(b.dev.name));

  listEl.innerHTML = "";
  rows.forEach(({ dev, activeCount }) => {
    const card = document.createElement("a");
    card.className = "developer-card";
    card.href = window.FuturaBreadcrumb.withOrigin("desarrolladora.html?dev=" + dev.slug, "desarrolladoras");
    card.innerHTML =
      "<div>" +
      '<h3 class="developer-card-name">' + dev.name + "</h3>" +
      '<p class="developer-card-count">' +
      activeCount +
      " proyecto" + (activeCount === 1 ? "" : "s") +
      " activo" + (activeCount === 1 ? "" : "s") +
      "</p>" +
      "</div>" +
      '<span class="developer-card-arrow" aria-hidden="true">→</span>';
    listEl.appendChild(card);
  });
})();
