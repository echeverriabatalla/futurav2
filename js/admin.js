// Panel interno: lista todos los proyectos con un switch para marcar/
// desmarcar "destacado" — ver js/featured-mock.js para dónde se persiste.
(() => {
  const PROJECTS = window.FUTURA_PROJECTS || [];
  const listEl = document.getElementById("admin-list");
  if (!listEl) return;

  listEl.innerHTML = "";
  PROJECTS.forEach((project) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML =
      '<div class="admin-row-info">' +
      "<h3>" +
      project.name +
      "</h3>" +
      "<p>" +
      project.developer.name +
      " · " +
      project.zone +
      " · Desde $" +
      project.priceFrom.toLocaleString("en-US") +
      "</p>" +
      "</div>" +
      '<label class="switch">' +
      '<input type="checkbox" aria-label="Destacar ' +
      project.name +
      '" />' +
      '<span class="switch-track"><span class="switch-thumb"></span></span>' +
      "</label>";

    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.checked = window.FuturaFeatured.isFeatured(project);
    checkbox.addEventListener("change", () => {
      window.FuturaFeatured.setFeatured(project.id, checkbox.checked);
    });

    listEl.appendChild(row);
  });
})();
