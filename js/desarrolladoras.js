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

  // El rating promedio depende de window.FuturaReviews (async), así que se
  // resuelven todas las reviews en paralelo antes de pintar las tarjetas.
  Promise.all(rows.map(({ dev }) => window.FuturaReviews.listForDeveloper(dev.slug))).then((allReviews) => {
    rows.forEach(({ dev, activeCount }, i) => {
      const { avg, count } = window.FuturaRating.average(allReviews[i]);
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
        (count
          ? '<p class="developer-card-rating">' +
            window.FuturaRating.starsDisplayHTML(avg, { size: "sm" }) +
            "<span>" + avg.toFixed(1) + " (" + count + " reseña" + (count === 1 ? "" : "s") + ")</span></p>"
          : "") +
        "</div>" +
        '<span class="developer-card-arrow" aria-hidden="true">→</span>';
      listEl.appendChild(card);
    });
  });
})();
