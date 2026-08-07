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

  // Un color fijo por proyecto (por id, no por posición en la lista
  // filtrada/ordenada, para que no cambie según los filtros activos) — así
  // se puede distinguir la isócrona de cada proyecto cuando hay varias
  // superpuestas en el mapa.
  const ISOCHRONE_COLORS = ["#3b66d6", "#d6573b", "#3bb8d6", "#d6b83b", "#8f3bd6", "#3bd68a", "#d63b8a", "#6b7cd6"];
  const isochroneColorById = {};
  PROJECTS.forEach((p, i) => {
    isochroneColorById[p.id] = ISOCHRONE_COLORS[i % ISOCHRONE_COLORS.length];
  });

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
  const routesPanelEl = document.getElementById("routes-panel");
  const routesListEl = document.getElementById("routes-list");
  const routesPanelTitleEl = document.getElementById("routes-panel-title");

  const zoneOptions = Array.from(new Set(PROJECTS.map((p) => p.zone)));

  // El perfil (núcleo familiar, ingresos, zona/trabajo/colegios del
  // asistente) solo se usa para personalizar esta página cuando se llega
  // acá justo después de que el asistente terminó sus preguntas — por
  // cualquier otro camino (ej. "Explorar proyectos") es un browse en blanco.
  const cameFromAgent = new URLSearchParams(window.location.search).get("from") === "agente";
  const profile = cameFromAgent ? loadProfile() : null;
  const filters = { zone: "", bedrooms: "0", propertyType: "", priceMin: 0, priceMax: PRICE_MAX, schools: [], workPlaces: [] };
  let seededFromProfile = false;

  renderPageCopy(profile);
  renderSummary(profile);
  seedFiltersFromProfile(profile);
  const schoolsChipFilter = setupPlaceChipFilter("filter-schools-input", "filter-schools-tags", "schools");
  const workChipFilter = setupPlaceChipFilter("filter-work-input", "filter-work-tags", "workPlaces");
  renderFilterControls();

  let map;
  let projectMarkers = [];
  let projectPolygons = [];
  let filterPinMarkers = [];
  let routePolylines = [];
  let selectedProject = null;
  const infoWindow = () => new google.maps.InfoWindow();

  applyFilters();

  loadGoogleMaps("geometry,places")
    .then(() => {
      initMap();
      schoolsChipFilter.activate();
      workChipFilter.activate();
    })
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

    // Mismo mecanismo que el filtro manual de chips: el agente ya
    // geocodificó estos lugares por separado, así que se agregan
    // directamente al mismo array que administra la UI de chips — el mapa
    // no necesita saber si un lugar vino del agente o de un chip manual.
    if (p.workPlaces && p.workPlaces.length) {
      filters.workPlaces = p.workPlaces.slice();
      seededFromProfile = true;
    }
    if (p.schoolPlaces && p.schoolPlaces.length) {
      filters.schools = p.schoolPlaces.slice();
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

  // Filtro de selección múltiple con chips removibles, respaldado por
  // Google Places Autocomplete — usado para Escuelas y Lugares de trabajo.
  // El input queda deshabilitado hasta que Maps+Places terminan de cargar
  // (activate()); mientras tanto ya se puede ver/editar lo que haya.
  function setupPlaceChipFilter(inputId, tagsId, filterKey) {
    const input = document.getElementById(inputId);
    const tagsEl = document.getElementById(tagsId);
    input.disabled = true;
    input.dataset.placeholder = input.placeholder;
    input.placeholder = "Cargando...";

    function renderTags() {
      tagsEl.innerHTML = "";
      filters[filterKey].forEach((place, idx) => {
        const tag = document.createElement("span");
        tag.className = "chip-tag";

        const label = document.createElement("span");
        label.textContent = place.label;

        const removeBtn = document.createElement("button");
        removeBtn.type = "button";
        removeBtn.setAttribute("aria-label", "Quitar " + place.label);
        removeBtn.textContent = "×";
        removeBtn.addEventListener("click", () => {
          filters[filterKey].splice(idx, 1);
          renderTags();
          seededFromProfile = false;
          updateFiltersNote();
          applyFilters();
        });

        tag.appendChild(label);
        tag.appendChild(removeBtn);
        tagsEl.appendChild(tag);
      });
    }

    renderTags();

    return {
      renderTags,
      activate() {
        input.disabled = false;
        input.placeholder = input.dataset.placeholder;

        const autocomplete = new google.maps.places.Autocomplete(input, {
          componentRestrictions: { country: "cr" },
          fields: ["geometry", "name", "formatted_address"],
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          if (!place || !place.geometry || !place.geometry.location) return;
          filters[filterKey].push({
            label: place.name || place.formatted_address || input.value,
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng(),
          });
          input.value = "";
          renderTags();
          seededFromProfile = false;
          updateFiltersNote();
          applyFilters();
        });
      },
    };
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
    filters.schools = [];
    filters.workPlaces = [];
    seededFromProfile = false;
    zoneSelect.value = "";
    typeSelect.value = "";
    bedroomsSelect.value = "0";
    updatePriceUI();
    schoolsChipFilter.renderTags();
    workChipFilter.renderTags();
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

  // Los puntos de referencia para el % de match: la zona activa en el
  // filtro (o si no hay ninguna elegida, la zona geocodificada del
  // asistente) más cualquier escuela/trabajo agregado como chip. Sin
  // ninguno de estos no hay con qué comparar, así que no se muestra match.
  function getReferencePoints() {
    const points = [];

    if (filters.zone) {
      const zoneProject = PROJECTS.find((p) => p.zone === filters.zone);
      if (zoneProject) points.push(zoneProject.location);
    } else if (profile && profile.zoneGeo) {
      points.push({ lat: profile.zoneGeo.lat, lng: profile.zoneGeo.lng });
    }

    filters.schools.forEach((s) => points.push({ lat: s.lat, lng: s.lng }));
    filters.workPlaces.forEach((w) => points.push({ lat: w.lat, lng: w.lng }));

    return points;
  }

  function applyFilters() {
    const filtered = getFilteredProjects();
    const refs = getReferencePoints();

    let scored = filtered.map((project) => ({ ...project }));
    if (refs.length) {
      scored = scored
        .map((project) => ({ ...project, matchScore: computeMatchScore(project, refs) }))
        .sort((a, b) => b.matchScore - a.matchScore);
    }

    // Si el proyecto seleccionado quedó afuera del filtro, se pierde la
    // selección (y con ella las rutas dibujadas).
    if (selectedProject && !scored.some((p) => p.id === selectedProject.id)) {
      selectedProject = null;
    }

    renderProjectList(scored, refs.length > 0);
    renderMapMarkers(scored);
    renderSelectedIsochrone();
    renderRoutes();
  }

  // Promedia la distancia a todos los puntos de referencia: un proyecto
  // "encaja" mejor cuando queda cerca de todos los lugares que importan, no
  // solo del más cercano.
  function computeMatchScore(project, refs) {
    const avgKm =
      refs.reduce((sum, ref) => sum + haversineKm(ref.lat, ref.lng, project.location.lat, project.location.lng), 0) /
      refs.length;
    const score = 96 - avgKm * 2.2;
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
    // Trabajo y colegios ya no se geocodifican acá aparte: el agente los
    // escribe en filters.workPlaces/filters.schools (ver seedFiltersFromProfile),
    // la misma fuente que alimenta los chips manuales, y renderMapMarkers()
    // los dibuja desde ahí sin importar el origen. Actividades no tiene un
    // filtro equivalente, así que sigue su propio camino.
    if (profile) {
      geocodeSupportPin(profile.activities, "#2fa88f", "Actividades", supportBounds);
    }

    // No renderMapMarkers(getFilteredProjects()) acá: eso crearía marcadores
    // sobre objetos de proyecto distintos a los que ya tiene renderizados la
    // lista (la primera pasada de applyFilters corre antes de que exista el
    // mapa), y project._marker quedaría wireado en el lugar equivocado —
    // los clics en las tarjetas no encontrarían su marcador. applyFilters()
    // reconstruye lista y mapa a partir del mismo array, así quedan
    // sincronizados.
    applyFilters();
  }

  function renderMapMarkers(projects) {
    if (!map) return;

    projectMarkers.forEach((m) => m.setMap(null));
    filterPinMarkers.forEach((m) => m.setMap(null));
    projectMarkers = [];
    filterPinMarkers = [];
    // La isócrona ya no se calcula para todos los proyectos visibles acá —
    // solo se dibuja la del proyecto seleccionado (ver renderSelectedIsochrone).

    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;

    if (profile && profile.zoneGeo) {
      bounds.extend({ lat: profile.zoneGeo.lat, lng: profile.zoneGeo.lng });
      hasBounds = true;
    }

    filters.schools.forEach((s) => {
      filterPinMarkers.push(addDot(s.lat, s.lng, "#a24fd6", "Colegio: " + s.label, 7));
      bounds.extend({ lat: s.lat, lng: s.lng });
      hasBounds = true;
    });
    filters.workPlaces.forEach((w) => {
      filterPinMarkers.push(addDot(w.lat, w.lng, "#4c74e0", "Trabajo: " + w.label, 7));
      bounds.extend({ lat: w.lat, lng: w.lng });
      hasBounds = true;
    });

    projects.forEach((project) => {
      bounds.extend(project.location);
      hasBounds = true;
      addProjectMarker(project);
    });

    if (hasBounds) map.fitBounds(bounds, 60);
  }

  // La isócrona de 20 min solo se muestra para el proyecto seleccionado, con
  // el mismo color que le corresponde en ISOCHRONE_COLORS.
  function renderSelectedIsochrone() {
    projectPolygons.forEach((p) => p.setMap(null));
    projectPolygons = [];

    if (!map || !selectedProject) return;

    const forProject = selectedProject;
    const color = isochroneColorById[forProject.id] || ISOCHRONE_COLORS[0];

    computeIsochrone(forProject.location, 20).then((path) => {
      // Si mientras se calculaba la isócrona el usuario ya eligió otro
      // proyecto (o ninguno), no dibujar la de una selección vieja.
      if (!path || selectedProject !== forProject) return;
      const polygon = new google.maps.Polygon({
        paths: path,
        map,
        fillColor: color,
        fillOpacity: 0.12,
        strokeColor: color,
        strokeOpacity: 0.55,
        strokeWeight: 1.5,
      });
      projectPolygons.push(polygon);
    });
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
      selectProject(project);
    });
    project._marker = marker;
    projectMarkers.push(marker);
  }

  // "Seleccionar" un proyecto (click en su marcador o en su tarjeta, que ya
  // dispara el click del marcador) dibuja la ruta hacia cada escuela/trabajo
  // guardado, con su tiempo estimado de viaje.
  function selectProject(project) {
    selectedProject = project;
    renderSelectedIsochrone();
    renderRoutes();
  }

  function renderRoutes() {
    routePolylines.forEach((p) => p.setMap(null));
    routePolylines = [];
    routesListEl.innerHTML = "";

    if (!map || !selectedProject) {
      routesPanelEl.hidden = true;
      return;
    }

    const destinations = filters.schools
      .map((s) => ({ label: s.label, lat: s.lat, lng: s.lng, kind: "Colegio", color: "#a24fd6" }))
      .concat(filters.workPlaces.map((w) => ({ label: w.label, lat: w.lat, lng: w.lng, kind: "Trabajo", color: "#4c74e0" })));

    if (!destinations.length) {
      routesPanelEl.hidden = true;
      return;
    }

    routesPanelEl.hidden = false;
    routesPanelTitleEl.textContent = "Rutas desde " + selectedProject.name;

    const directionsService = new google.maps.DirectionsService();

    destinations.forEach((dest) => {
      const item = document.createElement("div");
      item.className = "route-item";

      const dot = document.createElement("span");
      dot.className = "route-dot";
      dot.style.background = dest.color;

      const label = document.createElement("span");
      label.className = "route-label";
      label.textContent = dest.kind + ": " + dest.label;

      const duration = document.createElement("span");
      duration.className = "route-duration";
      duration.textContent = "Calculando...";

      item.appendChild(dot);
      item.appendChild(label);
      item.appendChild(duration);
      routesListEl.appendChild(item);

      directionsService.route(
        {
          origin: selectedProject.location,
          destination: { lat: dest.lat, lng: dest.lng },
          travelMode: "DRIVING",
        },
        (result, status) => {
          if (status !== "OK" || !result.routes[0] || !result.routes[0].legs[0]) {
            duration.textContent = "Ruta no disponible";
            return;
          }
          duration.textContent = result.routes[0].legs[0].duration.text;

          const polyline = new google.maps.Polyline({
            path: result.routes[0].overview_path,
            map,
            strokeColor: dest.color,
            strokeOpacity: 0.8,
            strokeWeight: 4,
          });
          routePolylines.push(polyline);
        }
      );
    });
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
