(() => {
  const PROJECTS = window.FUTURA_PROJECTS;
  const { floorPlanSVG, specList } = window.FuturaTypologyVisuals;
  const MAX_COMPARE = 4;
  const DEFAULT_HINT = "Marcá hasta " + MAX_COMPARE + " tipologías para incluirlas en tu solicitud.";

  const emailEl = document.getElementById("account-email");
  const signinBtn = document.getElementById("account-signin-btn");
  const signoutBtn = document.getElementById("account-signout-btn");
  const signedOutSection = document.getElementById("account-signed-out");
  const signedOutBtn = document.getElementById("account-signed-out-btn");
  const noSavedSection = document.getElementById("account-no-saved");
  const savedSection = document.getElementById("saved-section");
  const savedGrid = document.getElementById("saved-grid");
  const selectHint = document.getElementById("saved-select-hint");
  const leadRequestEl = document.getElementById("lead-request");
  const leadCopyEl = document.getElementById("lead-request-copy");
  const leadBtn = document.getElementById("lead-submit-btn");
  const LEAD_COPY_DEFAULT = leadCopyEl.textContent;

  const leadModalOverlay = document.getElementById("lead-modal-overlay");
  const leadModalBody = document.getElementById("lead-modal-body");
  const leadModalNote = document.getElementById("lead-modal-note");
  const leadModalSubmitBtn = document.getElementById("lead-modal-submit");
  const leadModalCloseBtn = document.getElementById("lead-modal-close");

  const selected = new Map();

  window.FuturaBreadcrumb.render({
    container: document.getElementById("breadcrumb-slot"),
    basePrefix: "../",
    currentLabel: "Mis proyectos",
    fallback: { href: "../resultados.html", label: "Resultados" },
  });

  leadBtn.addEventListener("click", openLeadModal);
  leadModalCloseBtn.addEventListener("click", closeLeadModal);
  leadModalOverlay.addEventListener("click", (e) => {
    if (e.target === leadModalOverlay) closeLeadModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !leadModalOverlay.hidden) closeLeadModal();
  });
  leadModalSubmitBtn.addEventListener("click", submitLeadModal);

  signinBtn.addEventListener("click", () => window.FuturaAuthModal.open(loadPage));
  signedOutBtn.addEventListener("click", () => window.FuturaAuthModal.open(loadPage));
  signoutBtn.addEventListener("click", () => {
    window.FuturaAuth.signOut().then(loadPage).catch(loadPage);
  });

  loadPage();

  function loadPage() {
    window.FuturaAuth.getSession()
      .then((session) => {
        if (!session) {
          showSignedOut();
          return;
        }
        showSignedIn(session);
        window.FuturaAuth.listSaved()
          .then(renderSaved)
          .catch(() => renderSaved([]));
      })
      .catch(() => showSignedOut());
  }

  function showSignedOut() {
    emailEl.hidden = true;
    signinBtn.hidden = false;
    signoutBtn.hidden = true;
    signedOutSection.hidden = false;
    noSavedSection.hidden = true;
    savedSection.hidden = true;
  }

  function showSignedIn(session) {
    emailEl.textContent = session.user.email;
    emailEl.hidden = false;
    signinBtn.hidden = true;
    signoutBtn.hidden = false;
    signedOutSection.hidden = true;
  }

  function enrich(row) {
    const project = PROJECTS.find((p) => p.id === row.project_id);
    if (!project) return null;
    const typology = project.typologies.find((t) => t.id === row.typology_id);
    if (!typology) return null;
    return { rowId: row.id, project, typology };
  }

  function renderSaved(rows) {
    const items = rows.map(enrich).filter(Boolean);
    selected.clear();

    if (items.length === 0) {
      noSavedSection.hidden = false;
      savedSection.hidden = true;
      return;
    }

    noSavedSection.hidden = true;
    savedSection.hidden = false;
    selectHint.textContent = DEFAULT_HINT;

    savedGrid.innerHTML = "";
    items.forEach((item) => {
      const card = document.createElement("article");
      card.className = "saved-card";
      card.innerHTML =
        '<div class="saved-card-image">' + floorPlanSVG(item.typology) + "</div>" +
        '<div class="saved-card-body">' +
        '<span class="saved-card-project">' + item.project.name + " · " + item.project.developer.name + "</span>" +
        "<h3>" + item.typology.name + "</h3>" +
        '<div class="typology-specs">' +
        specList(item.typology).map((s) => "<span>" + s + "</span>").join("") +
        "</div>" +
        '<span class="saved-card-price">Desde $' + item.project.priceFrom.toLocaleString("en-US") + "</span>" +
        '<a class="project-card-link" href="' +
        window.FuturaBreadcrumb.withOrigin("../proyecto.html?id=" + item.project.id, "cuenta") +
        '">Ver proyecto →</a>' +
        '<div class="saved-card-actions">' +
        '<label class="saved-card-check"><input type="checkbox" /> Solicitar información</label>' +
        '<button type="button" class="saved-card-remove">Eliminar</button>' +
        "</div></div>";

      card.querySelector('input[type="checkbox"]').addEventListener("change", (e) => toggleSelect(item, e.target));
      card.querySelector(".saved-card-remove").addEventListener("click", () => removeItem(item));

      savedGrid.appendChild(card);
    });

    updateLeadRequest();
  }

  function removeItem(item) {
    window.FuturaAuth.removeById(item.rowId)
      .then(() => window.FuturaAuth.listSaved().then(renderSaved))
      .catch(() => {
        /* si falla el borrado, la tarjeta se queda como estaba */
      });
  }

  function toggleSelect(item, checkbox) {
    if (checkbox.checked) {
      if (selected.size >= MAX_COMPARE) {
        checkbox.checked = false;
        selectHint.textContent = "Ya elegiste el máximo de " + MAX_COMPARE + ". Desmarcá alguna primero.";
        return;
      }
      selected.set(item.rowId, item);
      selectHint.textContent = DEFAULT_HINT;
    } else {
      selected.delete(item.rowId);
      selectHint.textContent = DEFAULT_HINT;
    }
    updateLeadRequest();
  }

  function updateLeadRequest() {
    resetLeadButton();
    leadRequestEl.hidden = selected.size === 0;
  }

  // ---------- Solicitar información (lead consolidado) ----------
  function loadAgentProfile() {
    try {
      const raw = localStorage.getItem("futuraUserProfile");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function resetLeadButton() {
    leadBtn.disabled = false;
    leadBtn.textContent = "Solicitar información";
    leadCopyEl.textContent = LEAD_COPY_DEFAULT;
  }

  // Agrupa las tipologías marcadas por proyecto: cada proyecto tiene sus
  // propios bancos disponibles, así que la solicitud se arma (y se manda)
  // por proyecto, no como un solo lead con todo mezclado.
  function groupSelectedByProject() {
    const groups = new Map();
    Array.from(selected.values()).forEach((item) => {
      if (!groups.has(item.project.id)) {
        groups.set(item.project.id, { project: item.project, typologies: [] });
      }
      groups.get(item.project.id).typologies.push(item.typology);
    });
    return Array.from(groups.values());
  }

  function openLeadModal() {
    renderLeadModal(groupSelectedByProject());
    leadModalNote.hidden = true;
    leadModalSubmitBtn.disabled = false;
    leadModalSubmitBtn.textContent = "Enviar solicitudes";
    leadModalOverlay.hidden = false;
  }

  function closeLeadModal() {
    leadModalOverlay.hidden = true;
  }

  function renderLeadModal(groups) {
    leadModalBody.innerHTML = "";
    groups.forEach((group) => {
      const banks = group.project.bancosDisponibles || [];
      const selectedBanks = new Set(window.FuturaBankSelection.get(group.project.id));

      const section = document.createElement("section");
      section.className = "lead-project-block";
      section.innerHTML =
        '<h4 class="lead-project-title">' +
        group.project.name +
        ' <span>· ' + group.project.developer.name + "</span></h4>" +
        '<ul class="lead-project-typologies">' +
        group.typologies.map((t) => "<li>" + t.name + " · " + t.sqm + " m² · " + t.bedrooms + " hab.</li>").join("") +
        "</ul>" +
        (banks.length
          ? '<div class="lead-project-banks"><p class="lead-project-banks-label">Bancos disponibles</p><div class="banks-grid"></div></div>'
          : '<p class="lead-project-banks-empty">Este proyecto no tiene bancos con convenio registrados.</p>');
      leadModalBody.appendChild(section);

      if (!banks.length) return;

      const grid = section.querySelector(".banks-grid");
      banks.forEach((bank) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "bank-chip" + (selectedBanks.has(bank) ? " is-active" : "");
        chip.textContent = (selectedBanks.has(bank) ? "✓ " : "") + bank;
        chip.addEventListener("click", () => {
          const nowSelected = window.FuturaBankSelection.toggle(group.project.id, bank);
          chip.classList.toggle("is-active", nowSelected);
          chip.textContent = (nowSelected ? "✓ " : "") + bank;
        });
        grid.appendChild(chip);
      });
    });
  }

  function submitLeadModal() {
    const groups = groupSelectedByProject();
    const profile = loadAgentProfile();

    leadModalNote.hidden = true;
    leadModalSubmitBtn.disabled = true;
    leadModalSubmitBtn.textContent = "Enviando...";

    Promise.all(
      groups.map((group) =>
        window.FuturaLeads.submit({
          profile,
          project_id: group.project.id,
          project_name: group.project.name,
          developer_name: group.project.developer.name,
          selected_banks: window.FuturaBankSelection.get(group.project.id),
          items: group.typologies.map((t) => ({
            typology_id: t.id,
            typology_name: t.name,
            sqm: t.sqm,
            bedrooms: t.bedrooms,
            bathrooms: t.bathrooms,
            price_from: group.project.priceFrom,
          })),
        })
      )
    )
      .then(() => {
        closeLeadModal();
        leadBtn.textContent = "✓ Solicitud enviada";
        leadCopyEl.textContent =
          "Listo — enviamos " + groups.length + " solicitud" + (groups.length === 1 ? "" : "es") +
          " (una por desarrolladora) con tu perfil y los bancos que elegiste.";
      })
      .catch(() => {
        leadModalNote.textContent = "No se pudo enviar alguna solicitud. Intentá de nuevo.";
        leadModalNote.hidden = false;
      })
      .finally(() => {
        leadModalSubmitBtn.disabled = false;
        leadModalSubmitBtn.textContent = "Enviar solicitudes";
      });
  }
})();
