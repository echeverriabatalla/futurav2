(() => {
  const { loadGoogleMaps, MAP_STYLE, computeIsochrone, addMapTypeToggle } = window.FuturaMapsUtils;
  const { floorPlanSVG, isoSVG, specList } = window.FuturaTypologyVisuals;
  const PROJECTS = window.FUTURA_PROJECTS;

  const POI_CATEGORIES = [
    { key: "supermarket", label: "Supermercados", color: "#4c74e0", placeType: "supermarket" },
    { key: "school", label: "Escuelas", color: "#a24fd6", placeType: "school" },
    { key: "park", label: "Parques", color: "#2fa88f", placeType: "park" },
    { key: "gym", label: "Gimnasios", color: "#e0954c", placeType: "gym" },
  ];

  const mainEl = document.getElementById("project-main");
  const emptyStateEl = document.getElementById("project-empty-state");

  const project = findProject();

  if (!project) {
    emptyStateEl.hidden = false;
    mainEl.hidden = true;
    document.title = "Proyecto no encontrado — FUTURA";
    return;
  }

  mainEl.hidden = false;
  document.title = project.name + " — FUTURA";

  renderHeader(project);
  renderTitleBar(project);
  renderTypologies(project);
  renderAmenities(project);
  renderBanks(project);
  initMap(project);

  function findProject() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");
    return PROJECTS.find((p) => p.id === id) || null;
  }

  function renderHeader(p) {
    const devLink = document.getElementById("dev-logo-link");
    const devText = document.getElementById("dev-logo-text");
    devText.textContent = p.developer.name;
    // La página propia de cada desarrolladora (listado de proyectos y
    // trayectoria) es una funcionalidad futura; el link ya queda listo.
    devLink.href = window.FuturaBreadcrumb.withOrigin("desarrolladora.html?dev=" + p.developer.slug, "proyecto", {
      pid: p.id,
      fromLabel: p.name,
    });

    document.getElementById("account-link").href = window.FuturaBreadcrumb.withOrigin("mi-cuenta/comparar.html", "proyecto", {
      pid: p.id,
      fromLabel: p.name,
    });

    window.FuturaBreadcrumb.render({
      container: document.getElementById("breadcrumb-slot"),
      currentLabel: p.name,
      fallback: { href: "resultados.html", label: "Resultados" },
    });
  }

  function renderTitleBar(p) {
    document.getElementById("project-name").textContent = p.name;
    document.getElementById("project-zone").textContent = p.zone;
    document.getElementById("project-price").textContent = "Desde $" + p.priceFrom.toLocaleString("en-US");
    document.getElementById("project-delivery").textContent = "Entrega " + p.delivery;
  }

  function renderBanks(p) {
    const bankNames = p.bancosDisponibles || [];
    const section = document.getElementById("banks-section");
    if (!bankNames.length) {
      section.hidden = true;
      return;
    }

    const grid = document.getElementById("banks-grid");
    grid.innerHTML = "";
    const selected = new Set(window.FuturaBankSelection.get(p.id));

    bankNames.forEach((name) => {
      const bank = window.FuturaBanks.get(name);
      if (!bank) return; // banco sin datos en el directorio (window.FUTURA_BANKS): no hay tarjeta que armar

      const isSelected = selected.has(bank.name);
      const defaultTermYears = Math.min(30, bank.maxTermYears);

      const card = document.createElement("article");
      card.className = "bank-card";
      card.innerHTML =
        '<div class="bank-card-head">' +
        "<h3>" + escapeHtml(bank.name) + "</h3>" +
        '<label class="bank-card-check"><input type="checkbox"' +
        (isSelected ? " checked" : "") +
        " /> Me interesa</label>" +
        "</div>" +
        '<div class="bank-card-stats">' +
        "<div><strong>" + bank.interestRate + "%</strong><span>Tasa anual</span></div>" +
        "<div><strong>" + bank.maxTermYears + " años</strong><span>Plazo máximo</span></div>" +
        "<div><strong>" + bank.financingPercent + "%</strong><span>Financiamiento</span></div>" +
        "</div>" +
        (bank.requirements
          ? '<p class="bank-card-requirements"><strong>Requisitos:</strong> ' + escapeHtml(bank.requirements) + "</p>"
          : "") +
        '<div class="bank-card-calculator">' +
        "<h4>Calculá tu cuota estimada</h4>" +
        '<div class="bank-calc-fields">' +
        '<label>Precio de la propiedad ($)<input type="number" class="bank-calc-price" min="0" step="1000" value="' +
        p.priceFrom +
        '" /></label>' +
        '<label>Prima / enganche (%)<input type="number" class="bank-calc-down" min="0" max="100" step="1" value="20" /></label>' +
        '<label>Plazo (años)<input type="number" class="bank-calc-term" min="1" max="' +
        bank.maxTermYears +
        '" step="1" value="' +
        defaultTermYears +
        '" /></label>' +
        "</div>" +
        '<div class="bank-calc-result"><span>Cuota mensual estimada</span><strong class="bank-calc-monthly"></strong></div>' +
        "</div>";

      card.querySelector(".bank-card-check input").addEventListener("change", () => {
        window.FuturaBankSelection.toggle(p.id, bank.name);
      });

      initBankCalculator(card, bank);

      grid.appendChild(card);
    });

    section.hidden = grid.children.length === 0;
  }

  function initBankCalculator(card, bank) {
    const priceInput = card.querySelector(".bank-calc-price");
    const downInput = card.querySelector(".bank-calc-down");
    const termInput = card.querySelector(".bank-calc-term");
    const resultEl = card.querySelector(".bank-calc-monthly");

    function update() {
      const price = Math.max(0, Number(priceInput.value) || 0);
      const downPercent = Math.min(100, Math.max(0, Number(downInput.value) || 0));
      const termYears = Math.min(bank.maxTermYears, Math.max(1, Number(termInput.value) || 1));
      const monthly = estimateMonthlyPayment(price, downPercent, termYears, bank.interestRate);
      resultEl.textContent = "$" + Math.round(monthly).toLocaleString("en-US");
    }

    [priceInput, downInput, termInput].forEach((input) => input.addEventListener("input", update));
    update();
  }

  // Amortización estándar: cuota = P · r(1+r)^n / ((1+r)^n - 1), con
  // P = precio menos la prima, r = tasa mensual, n = plazo en meses.
  function estimateMonthlyPayment(price, downPercent, termYears, annualRatePercent) {
    const principal = price * (1 - downPercent / 100);
    const monthlyRate = annualRatePercent / 100 / 12;
    const months = termYears * 12;
    if (principal <= 0 || months <= 0) return 0;
    if (monthlyRate === 0) return principal / months;
    const factor = Math.pow(1 + monthlyRate, months);
    return (principal * monthlyRate * factor) / (factor - 1);
  }

  function renderAmenities(p) {
    const grid = document.getElementById("amenities-grid");
    grid.innerHTML = "";
    window.FuturaAmenities.list(p).forEach((a) => {
      const photos = a.photos || [];
      const card = document.createElement("article");
      card.className = "amenity-card";
      card.innerHTML =
        '<div class="amenity-card-visual">' +
        (photos.length
          ? amenityGalleryHTML(photos, a.name)
          : '<div class="amenity-card-icon">' + window.FuturaAmenityIcons.iconSVG(a.icon) + "</div>") +
        "</div>" +
        '<div class="amenity-card-body">' +
        "<h3>" + escapeHtml(a.name) + "</h3>" +
        (a.description ? "<p>" + escapeHtml(a.description) + "</p>" : "") +
        "</div>";
      grid.appendChild(card);

      if (photos.length > 1) initAmenityGallery(card);
    });
  }

  function amenityGalleryHTML(photos, name) {
    return (
      '<div class="amenity-gallery">' +
      '<div class="amenity-gallery-track">' +
      photos.map((src) => '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(name) + '" loading="lazy" />').join("") +
      "</div>" +
      (photos.length > 1
        ? '<button type="button" class="amenity-gallery-arrow amenity-gallery-prev" aria-label="Foto anterior">‹</button>' +
          '<button type="button" class="amenity-gallery-arrow amenity-gallery-next" aria-label="Foto siguiente">›</button>' +
          '<div class="amenity-gallery-dots">' +
          photos.map((_, i) => '<span class="amenity-gallery-dot' + (i === 0 ? " is-active" : "") + '"></span>').join("") +
          "</div>"
        : "") +
      "</div>"
    );
  }

  function initAmenityGallery(card) {
    const gallery = card.querySelector(".amenity-gallery");
    const track = gallery.querySelector(".amenity-gallery-track");
    const dots = Array.from(gallery.querySelectorAll(".amenity-gallery-dot"));
    let index = 0;

    function update() {
      track.style.transform = "translateX(-" + index * 100 + "%)";
      dots.forEach((d, i) => d.classList.toggle("is-active", i === index));
    }

    gallery.querySelector(".amenity-gallery-prev").addEventListener("click", () => {
      index = (index - 1 + dots.length) % dots.length;
      update();
    });
    gallery.querySelector(".amenity-gallery-next").addEventListener("click", () => {
      index = (index + 1) % dots.length;
      update();
    });
  }

  // A diferencia del truco textContent→innerHTML (que no escapa comillas),
  // esto es seguro también dentro de atributos como src="..."/alt="...",
  // que es donde se usa para las fotos de amenidades cargadas desde admin.
  function escapeHtml(str) {
    return String(str == null ? "" : str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function renderTypologies(p) {
    const grid = document.getElementById("typology-grid");
    grid.innerHTML = "";
    p.typologies.forEach((t) => {
      const card = document.createElement("article");
      card.className = "typology-card";
      card.innerHTML =
        '<div class="typology-view">' +
        '<div class="typology-image is-active" data-view="plan">' + floorPlanSVG(t) + "</div>" +
        '<div class="typology-image" data-view="iso">' + isoSVG(t) + "</div>" +
        "</div>" +
        '<div class="typology-toggle" role="tablist">' +
        '<button type="button" class="typology-toggle-btn is-active" data-view="plan">Planta</button>' +
        '<button type="button" class="typology-toggle-btn" data-view="iso">Isométrico 3D</button>' +
        "</div>" +
        '<div class="typology-info">' +
        "<h3>" + t.name + "</h3>" +
        '<div class="typology-specs">' +
        specList(t).map((s) => "<span>" + s + "</span>").join("") +
        "</div>" +
        '<button type="button" class="compare-btn" data-id="' + t.id + '">+ Guardar proyecto</button>' +
        "</div>";

      const toggleBtns = card.querySelectorAll(".typology-toggle-btn");
      const views = card.querySelectorAll(".typology-image");
      toggleBtns.forEach((btn) => {
        btn.addEventListener("click", () => {
          toggleBtns.forEach((b) => b.classList.remove("is-active"));
          btn.classList.add("is-active");
          views.forEach((v) => v.classList.toggle("is-active", v.dataset.view === btn.dataset.view));
        });
      });

      card.querySelector(".compare-btn").addEventListener("click", (e) => {
        handleCompareClick(p, t, e.currentTarget);
      });

      grid.appendChild(card);
    });

    markSavedButtons(p);
  }

  // ---------- Guardar tipología en la cuenta (auth-gated) ----------
  function handleCompareClick(project, typology, btn) {
    if (btn.classList.contains("is-active")) {
      btn.disabled = true;
      window.FuturaAuth.removeTypology(project.id, typology.id)
        .then(() => {
          btn.classList.remove("is-active");
          btn.textContent = "+ Guardar proyecto";
        })
        .catch(() => {
          /* no se pudo quitar: se deja marcada como guardada */
        })
        .finally(() => {
          btn.disabled = false;
        });
      return;
    }

    window.FuturaAuth.getSession()
      .then((session) => {
        if (session) {
          saveAndMark(project, typology, btn);
        } else {
          window.FuturaAuthModal.open(() => saveAndMark(project, typology, btn));
        }
      })
      .catch(() => {
        // No se pudo confirmar la sesión (red caída, SDK bloqueado, etc.):
        // se asume que hace falta iniciar sesión. El modal va a mostrar el
        // error real si el intento de login también falla, dándole al
        // usuario un formulario donde reintentar en vez de un callejón
        // sin salida.
        window.FuturaAuthModal.open(() => saveAndMark(project, typology, btn));
      });
  }

  function saveAndMark(project, typology, btn) {
    btn.disabled = true;
    btn.textContent = "Guardando...";
    window.FuturaAuth.saveTypology(project.id, typology.id)
      .then(({ error }) => {
        if (error) throw error;
        btn.classList.add("is-active");
        btn.textContent = "✓ Proyecto guardado";
      })
      .catch(() => {
        btn.textContent = "No se pudo guardar";
        setTimeout(() => {
          btn.textContent = "+ Guardar proyecto";
        }, 2000);
      })
      .finally(() => {
        btn.disabled = false;
      });
  }

  function markSavedButtons(project) {
    window.FuturaAuth.getSession()
      .then((session) => {
        if (!session) return;
        return window.FuturaAuth.listSaved().then((rows) => {
          const savedIds = new Set(rows.filter((r) => r.project_id === project.id).map((r) => r.typology_id));
          document.querySelectorAll(".compare-btn").forEach((btn) => {
            if (savedIds.has(btn.dataset.id)) {
              btn.classList.add("is-active");
              btn.textContent = "✓ Proyecto guardado";
            }
          });
        });
      })
      .catch(() => {
        /* si no se puede consultar, las tarjetas quedan en su estado por defecto */
      });
  }

  function renderPoiFilters() {
    const wrap = document.getElementById("poi-filters");
    wrap.innerHTML = "";
    POI_CATEGORIES.forEach((cat) => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "poi-chip is-active";
      chip.dataset.key = cat.key;
      chip.innerHTML = '<i class="poi-chip-dot" style="background:' + cat.color + '"></i>' + cat.label;
      chip.addEventListener("click", () => {
        chip.classList.toggle("is-active");
        const visible = chip.classList.contains("is-active");
        (cat.markers || []).forEach((m) => m.setMap(visible ? cat._map : null));
      });
      wrap.appendChild(chip);
    });
  }

  function initMap(p) {
    renderPoiFilters();
    const mapEl = document.getElementById("project-map");
    const loadingEl = document.getElementById("project-map-loading");

    loadGoogleMaps("geometry,places")
      .then(() => {
        const map = new google.maps.Map(mapEl, {
          center: p.location,
          zoom: 14,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
        addMapTypeToggle(map);
        loadingEl.remove();

        new google.maps.Marker({
          position: p.location,
          map,
          title: p.name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: "#0b1220",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
          zIndex: 10,
        });

        loadPois(map, p.location);

        computeIsochrone(p.location, 20).then((path) => {
          if (!path) return;
          const polygon = new google.maps.Polygon({
            paths: path,
            map,
            fillColor: "#3b66d6",
            fillOpacity: 0.1,
            strokeColor: "#3b66d6",
            strokeOpacity: 0.55,
            strokeWeight: 1.5,
          });
          map.fitBounds(polygon.getBounds(), 40);
        });
      })
      .catch(() => {
        loadingEl.textContent = "No pudimos cargar el mapa en este momento.";
      });
  }

  function loadPois(map, location) {
    const service = new google.maps.places.PlacesService(map);

    POI_CATEGORIES.forEach((cat) => {
      cat._map = map;
      cat.markers = [];
      service.nearbySearch(
        {
          location,
          radius: 1500,
          type: cat.placeType,
        },
        (results, status) => {
          if (status !== google.maps.places.PlacesServiceStatus.OK || !results) return;
          results.forEach((place) => {
            if (!place.geometry || !place.geometry.location) return;

            const marker = new google.maps.Marker({
              position: place.geometry.location,
              map,
              title: place.name,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 6,
                fillColor: cat.color,
                fillOpacity: 1,
                strokeColor: "#ffffff",
                strokeWeight: 1.5,
              },
              zIndex: 4,
            });
            const iw = new google.maps.InfoWindow({
              content:
                '<div style="font-family: Inter, sans-serif; font-size:12.5px; color:#0b1220; max-width:180px;"><strong>' +
                place.name +
                "</strong><br/>" +
                (place.vicinity || "") +
                "</div>",
            });
            marker.addListener("click", () => iw.open(map, marker));
            cat.markers.push(marker);
          });
        }
      );
    });
  }
})();
