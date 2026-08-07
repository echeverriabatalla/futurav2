(() => {
  const { loadGoogleMaps, MAP_STYLE, haversineKm, computeIsochrone } = window.FuturaMapsUtils;
  const PROJECTS = window.FUTURA_PROJECTS;
  const GAM_CENTER = { lat: 9.9333, lng: -84.0833 };

  const BEDROOM_OPTIONS = [
    { value: "0", label: "Cualquier cantidad" },
    { value: "1", label: "1+ habitaciones" },
    { value: "2", label: "2+ habitaciones" },
    { value: "3", label: "3+ habitaciones" },
    { value: "4", label: "4+ habitaciones" },
  ];

  const PROPERTY_TYPE_OPTIONS = [
    { value: "", label: "Cualquier tipo" },
    { value: "apartamento", label: "Apartamento" },
    { value: "casa", label: "Casa" },
    { value: "lote", label: "Lote" },
  ];

  const PRICE_MAX = 500000;

  // Mismas etiquetas que usa el asistente en la pregunta de presupuesto:
  // ya no alimentan un <select>, solo sirven para convertir la respuesta
  // del asistente en un techo de precio para el slider.
  const PRICE_BRACKETS = [
    { value: "Menos de $150,000", label: "Menos de $150,000", max: 150000 },
    { value: "$150,000 – $250,000", label: "$150,000 – $250,000", min: 150000, max: 250000 },
    { value: "$250,000 – $400,000", label: "$250,000 – $400,000", min: 250000, max: 400000 },
    { value: "$400,000 – $600,000", label: "$400,000 – $600,000", min: 400000, max: 600000 },
    { value: "Más de $600,000", label: "Más de $600,000", min: 600000 },
  ];

  const summaryEl = document.getElementById("profile-summary");
  const mapEl = document.getElementById("results-map");
  const mapLoadingEl = document.getElementById("map-loading");
  const listEl = document.getElementById("project-list");
  const noMatchesEl = document.getElementById("no-matches-state");
  const filtersNoteEl = document.getElementById("filters-note");
  const zoneSelect = document.getElementById("filter-zone");
  const typeSelect = document.getElementById("filter-type");
  const bedroomsSelect = document.getElementById("filter-bedrooms");
  const priceMinInput = document.getElementById("filter-price-min");
  const priceMaxInput = document.getElementById("filter-price-max");
  const priceDisplayEl = document.getElementById("price-range-display");
  const priceFillEl = document.getElementById("price-range-fill");

  const zoneOptions = Array.from(new Set(PROJECTS.map((p) => p.zone)));

  const profile = loadProfile();
  const filters = { zone: "", bedrooms: "0", propertyType: "", priceMin: 0, priceMax: PRICE_MAX };
  let seededFromProfile = false;

  renderPageCopy(profile);
  renderSummary(profile);
  seedFiltersFromProfile(profile);
  renderFilterControls();

  let map;
  let projectMarkers = [];
  let projectPolygons = [];
  const infoWindow = () => new google.maps.InfoWindow();

  applyFilters();

  loadGoogleMaps("geometry")
    .then(initMap)
    .catch(() => {
      mapLoadingEl.textContent = "No pudimos cargar el mapa en este momento.";
    });

  function loadProfile() {
    try {
      const raw = localStorage.getItem("futuraUserProfile");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function renderPageCopy(p) {
    const eyebrow = p ? "Tu perfil de vida" : "Proyectos";
    const title = p ? "Los proyectos que encajan con tu familia" : "Todos los proyectos activos";
    const lead = p
      ? "Ubicamos tus zonas de trabajo, colegios y actividades, y calculamos qué tan bien encaja cada proyecto según cuánto tarda tu familia en llegar a los lugares que ya forman parte de su rutina."
      : "Explorá los proyectos en preventa del GAM y ajustá los filtros de ubicación, habitaciones y precio según lo que buscás.";

    document.getElementById("results-eyebrow").textContent = eyebrow;
    document.getElementById("results-title").textContent = title;
    document.getElementById("results-lead").textContent = lead;
    document.getElementById("list-eyebrow").textContent = p ? "Proyectos afines" : "Proyectos";
    document.getElementById("list-title").textContent = p ? "Ordenados por compatibilidad con tu vida" : "Todos los proyectos";
  }

  function renderSummary(p) {
    if (!p) {
      summaryEl.innerHTML = "";
      return;
    }
    const chips = [
      p.familySize ? p.familySize + " persona(s) en el núcleo familiar" : null,
      p.income ? "Ingresos: " + p.income : null,
    ].filter(Boolean);

    summaryEl.innerHTML = "";
    chips.forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "summary-chip";
      chip.textContent = text;
      summaryEl.appendChild(chip);
    });
  }

  // El asistente ya recolectó zona/presupuesto/tamaño de familia: los
  // usamos para prellenar estos mismos controles, no un mecanismo aparte.
  function seedFiltersFromProfile(p) {
    if (!p) return;

    if (p.zone) {
      const match = matchZoneOption(p.zone, zoneOptions);
      if (match) {
        filters.zone = match;
        seededFromProfile = true;
      }
    }

    if (p.budget) {
      const bracket = PRICE_BRACKETS.find((b) => b.value === p.budget);
      // Solo se prellena el techo: el presupuesto que contestó en el
      // asistente es lo más que quiere gastar, no un mínimo — un proyecto
      // más barato que su rango sigue siendo una opción válida.
      if (bracket && bracket.max != null) {
        filters.priceMax = clamp(bracket.max, 0, PRICE_MAX);
        seededFromProfile = true;
      }
    }

    if (p.familySize) {
      filters.bedrooms = String(suggestBedrooms(p.familySize));
      seededFromProfile = true;
    }
  }

  function suggestBedrooms(familySize) {
    const n = familySize === "5+" ? 5 : parseInt(familySize, 10) || 0;
    if (n <= 2) return 1;
    if (n <= 4) return 2;
    return 3;
  }

  function normalize(s) {
    return (s || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
  }

  function matchZoneOption(profileZone, options) {
    const nz = normalize(profileZone);
    if (!nz) return "";
    return options.find((z) => normalize(z).includes(nz)) || "";
  }

  function clamp(v, lo, hi) {
    return Math.max(lo, Math.min(hi, v));
  }

  function formatPrice(v) {
    return "$" + v.toLocaleString("en-US");
  }

  function updatePriceUI() {
    priceMinInput.value = filters.priceMin;
    priceMaxInput.value = filters.priceMax;
    const minPct = (filters.priceMin / PRICE_MAX) * 100;
    const maxPct = (filters.priceMax / PRICE_MAX) * 100;
    priceFillEl.style.left = minPct + "%";
    priceFillEl.style.right = 100 - maxPct + "%";
    const maxLabel = filters.priceMax >= PRICE_MAX ? "$500,000+" : formatPrice(filters.priceMax);
    priceDisplayEl.textContent = formatPrice(filters.priceMin) + " – " + maxLabel;
  }

  function renderFilterControls() {
    zoneSelect.innerHTML =
      '<option value="">Cualquier zona</option>' +
      zoneOptions.map((z) => '<option value="' + z + '">' + z + "</option>").join("");
    zoneSelect.value = filters.zone;

    typeSelect.innerHTML = PROPERTY_TYPE_OPTIONS.map((o) => '<option value="' + o.value + '">' + o.label + "</option>").join("");
    typeSelect.value = filters.propertyType;

    bedroomsSelect.innerHTML = BEDROOM_OPTIONS.map((o) => '<option value="' + o.value + '">' + o.label + "</option>").join("");
    bedroomsSelect.value = filters.bedrooms;

    updatePriceUI();
    updateFiltersNote();

    zoneSelect.addEventListener("change", () => {
      filters.zone = zoneSelect.value;
      seededFromProfile = false;
      updateFiltersNote();
      applyFilters();
    });
    typeSelect.addEventListener("change", () => {
      filters.propertyType = typeSelect.value;
      seededFromProfile = false;
      updateFiltersNote();
      applyFilters();
    });
    bedroomsSelect.addEventListener("change", () => {
      filters.bedrooms = bedroomsSelect.value;
      seededFromProfile = false;
      updateFiltersNote();
      applyFilters();
    });

    priceMinInput.addEventListener("input", () => {
      filters.priceMin = clamp(Number(priceMinInput.value), 0, filters.priceMax);
      seededFromProfile = false;
      updatePriceUI();
    });
    priceMinInput.addEventListener("change", () => {
      updateFiltersNote();
      applyFilters();
    });
    priceMaxInput.addEventListener("input", () => {
      filters.priceMax = clamp(Number(priceMaxInput.value), filters.priceMin, PRICE_MAX);
      seededFromProfile = false;
      updatePriceUI();
    });
    priceMaxInput.addEventListener("change", () => {
      updateFiltersNote();
      applyFilters();
    });

    document.getElementById("filters-reset").addEventListener("click", resetFilters);
    document.getElementById("no-matches-reset").addEventListener("click", resetFilters);
  }

  function updateFiltersNote() {
    filtersNoteEl.hidden = !seededFromProfile;
    filtersNoteEl.textContent = "Prellenados según tu conversación con el asistente — cambialos cuando quieras.";
  }

  function resetFilters() {
    filters.zone = "";
    filters.propertyType = "";
    filters.bedrooms = "0";
    filters.priceMin = 0;
    filters.priceMax = PRICE_MAX;
    seededFromProfile = false;
    zoneSelect.value = "";
    typeSelect.value = "";
    bedroomsSelect.value = "0";
    updatePriceUI();
    updateFiltersNote();
    applyFilters();
  }

  function maxBedrooms(project) {
    return Math.max.apply(
      null,
      project.typologies.map((t) => t.bedrooms)
    );
  }

  function getFilteredProjects() {
    const minBedrooms = parseInt(filters.bedrooms, 10) || 0;
    // El extremo derecho del slider en su tope ($500,000+) significa "sin
    // techo", ya que puede haber proyectos más caros que el rango del slider.
    const priceCeiling = filters.priceMax >= PRICE_MAX ? Infinity : filters.priceMax;

    return PROJECTS.filter((project) => {
      if (filters.zone && project.zone !== filters.zone) return false;
      if (filters.propertyType && project.propertyType !== filters.propertyType) return false;
      if (minBedrooms && maxBedrooms(project) < minBedrooms) return false;
      if (project.priceFrom < filters.priceMin) return false;
      if (project.priceFrom > priceCeiling) return false;
      return true;
    });
  }

  // El punto de referencia para el % de match: la zona activa en el filtro
  // si hay una elegida, si no la zona geocodificada del asistente. Sin
  // ninguna de las dos no hay con qué comparar, así que no se muestra match.
  function getReferencePoint() {
    if (filters.zone) {
      const zoneProject = PROJECTS.find((p) => p.zone === filters.zone);
      if (zoneProject) return zoneProject.location;
    }
    if (profile && profile.zoneGeo) return { lat: profile.zoneGeo.lat, lng: profile.zoneGeo.lng };
    return null;
  }

  function applyFilters() {
    const filtered = getFilteredProjects();
    const ref = getReferencePoint();

    let scored = filtered.map((project) => ({ ...project }));
    if (ref) {
      scored = scored
        .map((project) => ({ ...project, matchScore: computeMatchScore(project, ref) }))
        .sort((a, b) => b.matchScore - a.matchScore);
    }

    renderProjectList(scored, Boolean(ref));
    renderMapMarkers(scored);
  }

  function computeMatchScore(project, ref) {
    const distanceKm = haversineKm(ref.lat, ref.lng, project.location.lat, project.location.lng);
    const score = 96 - distanceKm * 2.2;
    return Math.max(45, Math.min(97, Math.round(score)));
  }

  function initMap() {
    map = new google.maps.Map(mapEl, {
      center: profile && profile.zoneGeo ? { lat: profile.zoneGeo.lat, lng: profile.zoneGeo.lng } : GAM_CENTER,
      zoom: 12,
      styles: MAP_STYLE,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
    });
    mapLoadingEl.remove();

    const supportBounds = new google.maps.LatLngBounds();
    if (profile && profile.zoneGeo) {
      addDot(profile.zoneGeo.lat, profile.zoneGeo.lng, "#c9a15a", "Zona preferida: " + profile.zoneGeo.formattedAddress, 9);
      supportBounds.extend({ lat: profile.zoneGeo.lat, lng: profile.zoneGeo.lng });
    }
    if (profile) {
      geocodeSupportPin(profile.workLocations, "#4c74e0", "Trabajo", supportBounds);
      geocodeSupportPin(profile.schools, "#a24fd6", "Colegio", supportBounds);
      geocodeSupportPin(profile.activities, "#2fa88f", "Actividades", supportBounds);
    }

    renderMapMarkers(getFilteredProjects());
  }

  function renderMapMarkers(projects) {
    if (!map) return;

    projectMarkers.forEach((m) => m.setMap(null));
    projectPolygons.forEach((p) => p.setMap(null));
    projectMarkers = [];
    projectPolygons = [];

    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

    if (profile && profile.zoneGeo) {
      bounds.extend({ lat: profile.zoneGeo.lat, lng: profile.zoneGeo.lng });
      hasBounds = true;
    }

    projects.forEach((project) => {
      bounds.extend(project.location);
      hasBounds = true;
      addProjectMarker(project);
      computeIsochrone(project.location, 20).then((path) => {
        if (!path) return;
        const polygon = new google.maps.Polygon({
          paths: path,
          map,
          fillColor: "#3b66d6",
          fillOpacity: 0.12,
          strokeColor: "#3b66d6",
          strokeOpacity: 0.55,
          strokeWeight: 1.5,
        });
        projectPolygons.push(polygon);
      });
    });

    if (hasBounds) map.fitBounds(bounds, 60);
  }

  function addDot(lat, lng, color, label, scale) {
    const marker = new google.maps.Marker({
      position: { lat, lng },
      map,
      title: label,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: scale || 7,
        fillColor: color,
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      zIndex: 5,
    });
    marker.addListener("click", () => {
      const iw = infoWindow();
      iw.setContent('<div style="font:600 13px Inter, sans-serif; color:#0b1220;">' + label + "</div>");
      iw.open(map, marker);
    });
    return marker;
  }

  function geocodeSupportPin(text, color, label, bounds) {
    if (!text) return;
    loadGoogleMaps("geometry").then(() => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ address: text + ", Costa Rica" }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const loc = results[0].geometry.location;
          const lat = loc.lat();
          const lng = loc.lng();
          addDot(lat, lng, color, label + ": " + results[0].formatted_address, 7);
          bounds.extend({ lat, lng });
          if (map) map.fitBounds(bounds, 60);
        }
        /* Si no se puede ubicar el texto, se omite el pin sin bloquear el mapa. */
      });
    });
  }

  function addProjectMarker(project) {
    const marker = new google.maps.Marker({
      position: project.location,
      map,
      title: project.name,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: "#0b1220",
        fillOpacity: 1,
        strokeColor: "#ffffff",
        strokeWeight: 2,
      },
      zIndex: 10,
    });
    marker.addListener("click", () => {
      const iw = infoWindow();
      iw.setContent(
        '<div style="font-family: Inter, sans-serif; max-width:200px;">' +
          '<strong style="color:#0b1220;">' + project.name + "</strong><br/>" +
          '<span style="color:#5b6b8c; font-size:12.5px;">' + project.zone + "</span><br/>" +
          '<span style="color:#3b66d6; font-weight:700; font-size:13px;">Desde $' +
          project.priceFrom.toLocaleString("en-US") +
          '</span><br/><a href="' +
          window.FuturaBreadcrumb.withOrigin("proyecto.html?id=" + project.id, "resultados") +
          '" style="color:#3b66d6; font-size:12px;">Ver proyecto →</a></div>'
      );
      iw.open(map, marker);
    });
    project._marker = marker;
    projectMarkers.push(marker);
  }

  function renderProjectList(scored, showMatch) {
    listEl.innerHTML = "";

    if (scored.length === 0) {
      noMatchesEl.hidden = false;
      return;
    }
    noMatchesEl.hidden = true;

    scored.forEach((project, index) => {
      const card = window.FuturaProjectCard.render(project, {
        matchScore: showMatch ? project.matchScore : null,
        badge: showMatch && index === 0 ? "Mejor match" : null,
        from: { from: "resultados" },
      });

      card.addEventListener("click", (e) => {
        if (e.target.closest(".project-card-link")) return;
        if (!map || !project._marker) return;
        map.panTo(project.location);
        map.setZoom(14);
        google.maps.event.trigger(project._marker, "click");
        document.getElementById("map-section").scrollIntoView({ behavior: "smooth", block: "start" });
      });

      listEl.appendChild(card);
    });
  }
})();
