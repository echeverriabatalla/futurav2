// Tarjeta de proyecto compartida — la usan resultados.html (con % de match)
// y desarrolladora.html (sin match, es un listado institucional), para no
// duplicar el marcado ni los estilos.
window.FuturaProjectCard = (() => {
  function render(project, opts) {
    opts = opts || {};
    const card = document.createElement("article");
    card.className = "project-card";

    let topBar = "";
    if (opts.badge || typeof opts.matchScore === "number") {
      topBar =
        '<div class="project-card-top">' +
        (opts.badge ? '<span class="project-badge">' + opts.badge + "</span>" : "") +
        (typeof opts.matchScore === "number" ? '<span class="project-match">' + opts.matchScore + "% match</span>" : "") +
        "</div>";
    }

    let link = "proyecto.html?id=" + project.id;
    if (opts.from && window.FuturaBreadcrumb) {
      link = window.FuturaBreadcrumb.withOrigin(link, opts.from.from, opts.from.extra);
    }

    card.innerHTML =
      topBar +
      "<h3>" + project.name + "</h3>" +
      '<p class="project-zone">' + project.zone + "</p>" +
      '<p class="project-price">Desde $' + project.priceFrom.toLocaleString("en-US") + "</p>" +
      '<div class="project-meta">' +
      "<span>" + project.bedrooms + "</span><span>Entrega " + project.delivery + "</span>" +
      "</div>" +
      '<div class="project-amenities">' +
      project.amenities.map((a) => '<span class="project-amenity">' + a.name + "</span>").join("") +
      "</div>" +
      '<a class="project-card-link" href="' + link + '">Ver proyecto →</a>';

    return card;
  }

  return { render };
})();
