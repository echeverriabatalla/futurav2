// Carrusel de "Proyectos destacados" en la página principal — muestra los
// proyectos marcados como destacados (ver js/featured-mock.js), con scroll
// horizontal nativo (swipe en touch, flechas en desktop) y click directo a
// la página del proyecto.
(() => {
  const sectionEl = document.getElementById("destacados");
  const trackEl = document.getElementById("featured-track");
  const prevBtn = document.getElementById("featured-prev");
  const nextBtn = document.getElementById("featured-next");

  if (!sectionEl || !trackEl) return;

  const PROJECTS = window.FUTURA_PROJECTS || [];
  const featured = window.FuturaFeatured ? window.FuturaFeatured.listFeatured(PROJECTS) : [];

  if (!featured.length) {
    sectionEl.hidden = true;
    return;
  }

  const SKYLINE_SVG =
    '<svg class="featured-card-skyline" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<rect x="8" y="42" width="22" height="58" />' +
    '<rect x="38" y="18" width="22" height="82" />' +
    '<rect x="68" y="52" width="22" height="48" />' +
    '<rect x="98" y="8" width="22" height="92" />' +
    '<rect x="128" y="32" width="22" height="68" />' +
    '<rect x="158" y="46" width="22" height="54" />' +
    '<rect x="103" y="18" width="6" height="6" class="featured-card-window" />' +
    '<rect x="113" y="18" width="6" height="6" class="featured-card-window" />' +
    "</svg>";

  const propertyTypeLabels = { apartamento: "Apartamento", casa: "Casa", lote: "Lote" };

  trackEl.innerHTML = "";
  featured.forEach((project, i) => {
    const card = document.createElement("a");
    card.className = "featured-card";
    card.href = window.FuturaBreadcrumb.withOrigin("proyecto.html?id=" + project.id, "inicio");
    card.innerHTML =
      '<div class="featured-card-visual featured-card-visual--' +
      (i % 4) +
      '">' +
      SKYLINE_SVG +
      '<span class="featured-card-badge">' +
      (propertyTypeLabels[project.propertyType] || project.propertyType) +
      "</span>" +
      "</div>" +
      '<div class="featured-card-body">' +
      "<h3>" +
      project.name +
      "</h3>" +
      '<p class="featured-card-developer">' +
      project.developer.name +
      "</p>" +
      '<p class="featured-card-price">Desde $' +
      project.priceFrom.toLocaleString("en-US") +
      "</p>" +
      "</div>";
    trackEl.appendChild(card);
  });

  function scrollByCard(direction) {
    const card = trackEl.querySelector(".featured-card");
    const amount = card ? card.getBoundingClientRect().width + 20 : 300;
    trackEl.scrollBy({ left: direction * amount, behavior: "smooth" });
  }

  prevBtn.addEventListener("click", () => scrollByCard(-1));
  nextBtn.addEventListener("click", () => scrollByCard(1));
})();
