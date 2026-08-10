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

  function renderAmenities(p) {
    const grid = document.getElementById("amenities-grid");
    grid.innerHTML = "";
    p.amenities.forEach((a) => {
      const card = document.createElement("div");
      card.className = "amenity-card";
      card.innerHTML = '<span class="amenity-dot"></span><span>' + a + "</span>";
      grid.appendChild(card);
    });
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
        '<button type="button" class="compare-btn" data-id="' + t.id + '">+ Solicitar información</button>' +
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
          btn.textContent = "+ Solicitar información";
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
        btn.textContent = "✓ En mi solicitud";
      })
      .catch(() => {
        btn.textContent = "No se pudo guardar";
        setTimeout(() => {
          btn.textContent = "+ Solicitar información";
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
              btn.textContent = "✓ En mi solicitud";
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
