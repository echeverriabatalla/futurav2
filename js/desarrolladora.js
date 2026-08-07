(() => {
  const { loadGoogleMaps, MAP_STYLE } = window.FuturaMapsUtils;
  const PROJECTS = window.FUTURA_PROJECTS;
  const DEVELOPERS = window.FUTURA_DEVELOPERS;

  const mainEl = document.getElementById("developer-main");
  const emptyStateEl = document.getElementById("developer-empty-state");

  const developer = findDeveloper();

  if (!developer) {
    emptyStateEl.hidden = false;
    mainEl.hidden = true;
    document.title = "Desarrolladora no encontrada — FUTURA";
    return;
  }

  const activeProjects = PROJECTS.filter((p) => p.developer.slug === developer.slug);

  mainEl.hidden = false;
  document.title = developer.name + " — FUTURA";

  renderHeader(developer, activeProjects);
  renderProjectList(activeProjects);
  initMap(activeProjects);

  function findDeveloper() {
    const params = new URLSearchParams(window.location.search);
    const slug = params.get("dev");
    return DEVELOPERS.find((d) => d.slug === slug) || null;
  }

  function renderHeader(dev, projects) {
    document.getElementById("dev-name").textContent = dev.name;
    document.getElementById("dev-description").textContent = dev.description;
    document.getElementById("dev-stat-projects").textContent = dev.projectsCompleted + "+";
    document.getElementById("dev-stat-years").textContent = new Date().getFullYear() - dev.foundedYear;
    document.getElementById("dev-stat-active").textContent = projects.length;

    window.FuturaBreadcrumb.render({
      container: document.getElementById("breadcrumb-slot"),
      currentLabel: dev.name,
      fallback: { href: "resultados.html", label: "Resultados" },
    });
  }

  function renderProjectList(projects) {
    const grid = document.getElementById("dev-project-list");
    grid.innerHTML = "";
    projects.forEach((project) => {
      grid.appendChild(
        window.FuturaProjectCard.render(project, {
          from: { from: "desarrolladora", extra: { dev: developer.slug, fromLabel: developer.name } },
        })
      );
    });
  }

  function initMap(projects) {
    const mapEl = document.getElementById("dev-map");
    const loadingEl = document.getElementById("dev-map-loading");

    loadGoogleMaps("geometry")
      .then(() => {
        const map = new google.maps.Map(mapEl, {
          zoom: 11,
          styles: MAP_STYLE,
          disableDefaultUI: true,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
        });
        loadingEl.remove();

        const bounds = new google.maps.LatLngBounds();
        const infoWindow = new google.maps.InfoWindow();

        projects.forEach((project) => {
          bounds.extend(project.location);
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
          });
          marker.addListener("click", () => {
            infoWindow.setContent(
              '<div style="font-family: Inter, sans-serif; max-width:200px;">' +
                '<strong style="color:#0b1220;">' + project.name + "</strong><br/>" +
                '<span style="color:#5b6b8c; font-size:12.5px;">' + project.zone + "</span><br/>" +
                '<a href="' +
                window.FuturaBreadcrumb.withOrigin("proyecto.html?id=" + project.id, "desarrolladora", {
                  dev: developer.slug,
                  fromLabel: developer.name,
                }) +
                '" style="color:#3b66d6; font-size:12px;">Ver proyecto →</a></div>'
            );
            infoWindow.open(map, marker);
          });
        });

        if (!bounds.isEmpty()) map.fitBounds(bounds, 60);
      })
      .catch(() => {
        loadingEl.textContent = "No pudimos cargar el mapa en este momento.";
      });
  }
})();
