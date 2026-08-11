(() => {
  const { loadGoogleMaps, MAP_STYLE, addMapTypeToggle } = window.FuturaMapsUtils;
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
  initReviews(developer);

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

    document.getElementById("account-link").href = window.FuturaBreadcrumb.withOrigin("mi-cuenta/comparar.html", "desarrolladora", {
      dev: dev.slug,
      fromLabel: dev.name,
    });

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
        addMapTypeToggle(map);
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

  // ===================== Reseñas =====================

  function initReviews(dev) {
    let selectedRating = 0;
    let myReview = null;

    const starButtons = Array.from(document.querySelectorAll("#review-star-input .star-input-star"));
    const commentEl = document.getElementById("review-comment");
    const submitBtn = document.getElementById("review-submit");
    const formTitleEl = document.getElementById("review-form-title");
    const noteEl = document.getElementById("review-form-note");

    starButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        selectedRating = Number(btn.dataset.value);
        paintStars();
      });
    });

    submitBtn.addEventListener("click", () => {
      if (!selectedRating) {
        showNote("Elegí una calificación de 1 a 5 estrellas.");
        return;
      }
      window.FuturaAuth.getUser().then((user) => {
        if (!user) {
          window.FuturaAuthModal.open(() => submitReview(dev.slug));
          return;
        }
        submitReview(dev.slug);
      });
    });

    function submitReview(devSlug) {
      submitBtn.disabled = true;
      submitBtn.textContent = "Publicando...";
      window.FuturaReviews.upsertReview(devSlug, selectedRating, commentEl.value.trim())
        .then((row) => {
          myReview = row;
          showNote("");
          loadReviews(dev.slug);
        })
        .catch(() => showNote("No pudimos guardar tu reseña. Intentá de nuevo."))
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = myReview ? "Actualizar reseña" : "Publicar reseña";
        });
    }

    function paintStars() {
      starButtons.forEach((btn) => {
        btn.classList.toggle("is-filled", Number(btn.dataset.value) <= selectedRating);
      });
    }

    function showNote(msg) {
      noteEl.textContent = msg || "";
      noteEl.hidden = !msg;
    }

    function applyMyReview(row) {
      myReview = row;
      if (!row) return;
      selectedRating = row.rating;
      paintStars();
      commentEl.value = row.comentario || "";
      formTitleEl.textContent = "Tu reseña";
      submitBtn.textContent = "Actualizar reseña";
    }

    function loadReviews(devSlug) {
      window.FuturaReviews.listForDeveloper(devSlug).then((reviews) => {
        renderSummary(reviews);
        renderList(reviews);
      });
    }

    function renderSummary(reviews) {
      const { avg, count } = window.FuturaRating.average(reviews);

      const heroEl = document.getElementById("dev-hero-rating");
      const summaryEl = document.getElementById("reviews-summary");

      if (!count) {
        heroEl.hidden = true;
        summaryEl.hidden = true;
        return;
      }

      heroEl.hidden = false;
      heroEl.innerHTML =
        window.FuturaRating.starsDisplayHTML(avg, { size: "lg" }) +
        "<strong>" + avg.toFixed(1) + "</strong><span>(" + count + " reseña" + (count === 1 ? "" : "s") + ")</span>";

      summaryEl.hidden = false;
      document.getElementById("reviews-summary-avg").textContent = avg.toFixed(1);
      document.getElementById("reviews-summary-stars").innerHTML = window.FuturaRating.starsDisplayHTML(avg, {});
      document.getElementById("reviews-summary-count").textContent =
        count + " reseña" + (count === 1 ? "" : "s");
    }

    function renderList(reviews) {
      const listEl = document.getElementById("review-list");
      const emptyEl = document.getElementById("review-empty");

      if (!reviews.length) {
        listEl.innerHTML = "";
        emptyEl.hidden = false;
        return;
      }

      emptyEl.hidden = true;
      listEl.innerHTML = reviews
        .map(
          (r) =>
            '<article class="review-item">' +
            '<div class="review-item-head">' +
            '<span class="review-item-user">' + escapeHtml(r.user_name) + "</span>" +
            window.FuturaRating.starsDisplayHTML(r.rating, { size: "sm" }) +
            "</div>" +
            '<span class="review-item-date">' + formatFecha(r.fecha) + "</span>" +
            (r.comentario ? '<p class="review-item-comment">' + escapeHtml(r.comentario) + "</p>" : "") +
            "</article>"
        )
        .join("");
    }

    function formatFecha(iso) {
      try {
        return new Date(iso).toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" });
      } catch (e) {
        return "";
      }
    }

    function escapeHtml(str) {
      const div = document.createElement("div");
      div.textContent = str == null ? "" : String(str);
      return div.innerHTML;
    }

    window.FuturaReviews.getMyReview(dev.slug).then(applyMyReview);
    loadReviews(dev.slug);
  }
})();
