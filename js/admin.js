// Panel interno: lista todos los proyectos con un switch para marcar/
// desmarcar "destacado" (ver js/featured-mock.js), un botón para editar
// las amenidades de cada proyecto (nombre, descripción, ícono y fotos —
// ver js/amenities-mock.js), y el directorio de bancos (tasa, plazo,
// financiamiento, requisitos — ver js/banks-mock.js), ya que estos datos
// cambian seguido y no hay una fuente automática confiable.
(() => {
  const PROJECTS = window.FUTURA_PROJECTS || [];
  const listEl = document.getElementById("admin-list");
  if (!listEl) return;

  const amenitiesOverlay = document.getElementById("amenities-modal-overlay");
  const amenitiesTitle = document.getElementById("amenities-modal-title");
  const amenitiesBody = document.getElementById("amenities-modal-body");
  const amenitiesAddBtn = document.getElementById("amenities-add-btn");
  const amenitiesSaveBtn = document.getElementById("amenities-save-btn");
  const amenitiesCloseBtn = document.getElementById("amenities-modal-close");

  let editingProject = null;

  listEl.innerHTML = "";
  PROJECTS.forEach((project) => {
    const row = document.createElement("div");
    row.className = "admin-row";
    row.innerHTML =
      '<div class="admin-row-info">' +
      "<h3>" + escapeHtml(project.name) + "</h3>" +
      "<p>" + escapeHtml(project.developer.name) + " · " + escapeHtml(project.zone) + " · Desde $" +
      project.priceFrom.toLocaleString("en-US") + "</p>" +
      "</div>" +
      '<div class="admin-row-actions">' +
      '<button type="button" class="btn btn-ghost btn-sm admin-edit-amenities-btn">Editar amenidades</button>' +
      '<label class="switch">' +
      '<input type="checkbox" aria-label="Destacar ' + escapeHtml(project.name) + '" />' +
      '<span class="switch-track"><span class="switch-thumb"></span></span>' +
      "</label>" +
      "</div>";

    const checkbox = row.querySelector('input[type="checkbox"]');
    checkbox.checked = window.FuturaFeatured.isFeatured(project);
    checkbox.addEventListener("change", () => {
      window.FuturaFeatured.setFeatured(project.id, checkbox.checked);
    });

    row.querySelector(".admin-edit-amenities-btn").addEventListener("click", () => openAmenitiesModal(project));

    listEl.appendChild(row);
  });

  amenitiesCloseBtn.addEventListener("click", closeAmenitiesModal);
  amenitiesOverlay.addEventListener("click", (e) => {
    if (e.target === amenitiesOverlay) closeAmenitiesModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !amenitiesOverlay.hidden) closeAmenitiesModal();
  });
  amenitiesAddBtn.addEventListener("click", () => {
    addAmenityRow({ name: "", description: "", icon: "default", photos: [] });
  });
  amenitiesSaveBtn.addEventListener("click", saveAmenities);

  function openAmenitiesModal(project) {
    editingProject = project;
    amenitiesTitle.textContent = "Amenidades — " + project.name;
    amenitiesBody.innerHTML = "";
    window.FuturaAmenities.list(project).forEach(addAmenityRow);
    amenitiesOverlay.hidden = false;
  }

  function closeAmenitiesModal() {
    amenitiesOverlay.hidden = true;
    editingProject = null;
  }

  function addAmenityRow(a) {
    const row = document.createElement("div");
    row.className = "amenity-edit-row";
    row.innerHTML =
      '<div class="amenity-edit-row-fields">' +
      '<label class="amenity-edit-field">Nombre<input type="text" class="amenity-edit-name" value="' +
      escapeHtml(a.name) +
      '" placeholder="Ej. Piscina" /></label>' +
      '<label class="amenity-edit-field">Ícono (respaldo sin fotos)<select class="amenity-edit-icon">' +
      window.FuturaAmenityIcons.ICON_OPTIONS.map(
        (opt) => '<option value="' + opt.key + '"' + (opt.key === a.icon ? " selected" : "") + ">" + opt.label + "</option>"
      ).join("") +
      "</select></label>" +
      "</div>" +
      '<label class="amenity-edit-field">Descripción (tipo, tamaño, detalles del espacio)<textarea class="amenity-edit-description" rows="2">' +
      escapeHtml(a.description || "") +
      "</textarea></label>" +
      '<label class="amenity-edit-field">Fotos — una URL por línea (opcional; sin fotos se usa el ícono)<textarea class="amenity-edit-photos" rows="2" placeholder="https://...">' +
      escapeHtml((a.photos || []).join("\n")) +
      "</textarea></label>" +
      '<button type="button" class="amenity-edit-remove">Eliminar amenidad</button>';

    row.querySelector(".amenity-edit-remove").addEventListener("click", () => row.remove());

    amenitiesBody.appendChild(row);
  }

  function saveAmenities() {
    if (!editingProject) return;

    const amenities = Array.from(amenitiesBody.querySelectorAll(".amenity-edit-row"))
      .map((row) => ({
        name: row.querySelector(".amenity-edit-name").value.trim(),
        description: row.querySelector(".amenity-edit-description").value.trim(),
        icon: row.querySelector(".amenity-edit-icon").value,
        photos: row
          .querySelector(".amenity-edit-photos")
          .value.split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      }))
      .filter((a) => a.name);

    window.FuturaAmenities.save(editingProject.id, amenities);
    closeAmenitiesModal();
  }

  // ---------- Directorio de bancos ----------

  const banksListEl = document.getElementById("admin-banks-list");
  const bankOverlay = document.getElementById("bank-modal-overlay");
  const bankTitle = document.getElementById("bank-modal-title");
  const bankCloseBtn = document.getElementById("bank-modal-close");
  const bankSaveBtn = document.getElementById("bank-save-btn");
  const bankRateInput = document.getElementById("bank-edit-rate");
  const bankTermInput = document.getElementById("bank-edit-term");
  const bankFinancingInput = document.getElementById("bank-edit-financing");
  const bankRequirementsInput = document.getElementById("bank-edit-requirements");

  let editingBankName = null;

  if (banksListEl) {
    renderBanksList();

    bankCloseBtn.addEventListener("click", closeBankModal);
    bankOverlay.addEventListener("click", (e) => {
      if (e.target === bankOverlay) closeBankModal();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !bankOverlay.hidden) closeBankModal();
    });
    bankSaveBtn.addEventListener("click", saveBank);
  }

  function renderBanksList() {
    banksListEl.innerHTML = "";
    window.FuturaBanks.list().forEach((bank) => {
      const row = document.createElement("div");
      row.className = "admin-row";
      row.innerHTML =
        '<div class="admin-row-info">' +
        "<h3>" + escapeHtml(bank.name) + "</h3>" +
        "<p>" + bank.interestRate + "% anual · Plazo hasta " + bank.maxTermYears + " años · Financia hasta " + bank.financingPercent + "%</p>" +
        "</div>" +
        '<div class="admin-row-actions">' +
        '<button type="button" class="btn btn-ghost btn-sm admin-edit-bank-btn">Editar</button>' +
        "</div>";

      row.querySelector(".admin-edit-bank-btn").addEventListener("click", () => openBankModal(bank));

      banksListEl.appendChild(row);
    });
  }

  function openBankModal(bank) {
    editingBankName = bank.name;
    bankTitle.textContent = "Editar banco — " + bank.name;
    bankRateInput.value = bank.interestRate;
    bankTermInput.value = bank.maxTermYears;
    bankFinancingInput.value = bank.financingPercent;
    bankRequirementsInput.value = bank.requirements || "";
    bankOverlay.hidden = false;
  }

  function closeBankModal() {
    bankOverlay.hidden = true;
    editingBankName = null;
  }

  function saveBank() {
    if (!editingBankName) return;
    window.FuturaBanks.save(editingBankName, {
      interestRate: Number(bankRateInput.value) || 0,
      maxTermYears: Number(bankTermInput.value) || 1,
      financingPercent: Number(bankFinancingInput.value) || 0,
      requirements: bankRequirementsInput.value.trim(),
    });
    closeBankModal();
    renderBanksList();
  }

  // Atributo-seguro: a diferencia del truco textContent→innerHTML, también
  // escapa comillas, necesario porque se usa dentro de value="...".
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }
})();
