// Utilidades de Google Maps compartidas entre resultados.html y proyecto.html.
window.FuturaMapsUtils = (() => {
  // Restrict this key by HTTP referrer in Google Cloud Console. Requires
  // "Maps JavaScript API", "Geocoding API", "Distance Matrix API" and
  // "Places API" enabled.
  const GOOGLE_MAPS_API_KEY = "AIzaSyCp6hfATMHB75MEv_werB1IV5yNUjTu1vM";
  const ISOCHRONE_MINUTES = 20;

  let loadPromise = null;

  function loadGoogleMaps(libraries) {
    if (window.google && window.google.maps) return Promise.resolve();
    if (loadPromise) return loadPromise;
    loadPromise = new Promise((resolve, reject) => {
      const callbackName = "__futuraMapsUtilsReady";
      window[callbackName] = () => resolve();
      const script = document.createElement("script");
      script.src =
        "https://maps.googleapis.com/maps/api/js?key=" +
        GOOGLE_MAPS_API_KEY +
        "&libraries=" +
        (libraries || "geometry") +
        "&callback=" +
        callbackName;
      script.async = true;
      script.defer = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return loadPromise;
  }

  const MAP_STYLE = [
    { elementType: "geometry", stylers: [{ color: "#eef1f8" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#5b6b8c" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#ffffff" }] },
    { featureType: "administrative", elementType: "geometry", stylers: [{ color: "#c6cfe3" }] },
    { featureType: "poi", stylers: [{ visibility: "off" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
    { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#f3f5fb" }] },
    { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#d9e0f2" }] },
    { featureType: "transit", stylers: [{ visibility: "off" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#c9d6ee" }] },
  ];

  // Distancia en línea recta (fórmula de Haversine) — no depende de la API
  // de Google, así funciones como el match score corren incluso sin mapa.
  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Aproxima la isócrona de N minutos: muestrea tiempos de viaje en 8
  // direcciones con la Distance Matrix API y estima, por interpolación, el
  // punto de cada rayo donde el tiempo cruza el umbral.
  function computeIsochrone(location, minutes) {
    const targetMinutes = minutes || ISOCHRONE_MINUTES;
    return loadGoogleMaps("geometry")
      .then(
        () =>
          new Promise((resolve) => {
            const origin = new google.maps.LatLng(location.lat, location.lng);
            const bearings = [0, 45, 90, 135, 180, 225, 270, 315];
            const sampleDistancesM = [5000, 10000, 16000];

            const destinations = [];
            bearings.forEach((bearing) => {
              sampleDistancesM.forEach((dist) => {
                destinations.push(google.maps.geometry.spherical.computeOffset(origin, dist, bearing));
              });
            });

            const service = new google.maps.DistanceMatrixService();
            service.getDistanceMatrix(
              {
                origins: [origin],
                destinations,
                travelMode: "DRIVING",
              },
              (response, status) => {
                if (status !== "OK" || !response || !response.rows || !response.rows[0]) {
                  resolve(null);
                  return;
                }
                const elements = response.rows[0].elements;
                const targetSeconds = targetMinutes * 60;
                const polygonPoints = [];

                bearings.forEach((bearing, bIdx) => {
                  const rayElements = sampleDistancesM.map((_, dIdx) => elements[bIdx * sampleDistancesM.length + dIdx]);
                  let boundaryDistance = sampleDistancesM[0];

                  for (let i = 0; i < rayElements.length; i++) {
                    const el = rayElements[i];
                    if (!el || el.status !== "OK") continue;
                    const duration = el.duration.value;

                    if (duration >= targetSeconds) {
                      if (i === 0) {
                        boundaryDistance = sampleDistancesM[0];
                      } else {
                        const prevEl = rayElements[i - 1];
                        const prevDuration = prevEl && prevEl.status === "OK" ? prevEl.duration.value : 0;
                        const prevDist = sampleDistancesM[i - 1];
                        const dist = sampleDistancesM[i];
                        const ratio = (targetSeconds - prevDuration) / (duration - prevDuration || 1);
                        boundaryDistance = prevDist + ratio * (dist - prevDist);
                      }
                      break;
                    }
                    boundaryDistance = sampleDistancesM[i];
                  }

                  polygonPoints.push(google.maps.geometry.spherical.computeOffset(origin, boundaryDistance, bearing));
                });

                resolve(polygonPoints);
              }
            );
          })
      )
      .catch(() => null);
  }

  // Botón "Mapa/Satélite" al estilo del control nativo de Google Maps, pero
  // con el look del sitio — se agrega como control propio del mapa
  // (map.controls) para que Google lo posicione y espacie automáticamente
  // junto al zoom, sin pelear con z-index/posicionamiento manual.
  function addMapTypeToggle(map) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "map-type-toggle";
    btn.textContent = "Satélite";

    btn.addEventListener("click", () => {
      const isSatellite = map.getMapTypeId() === google.maps.MapTypeId.SATELLITE;
      map.setMapTypeId(isSatellite ? google.maps.MapTypeId.ROADMAP : google.maps.MapTypeId.SATELLITE);
      btn.textContent = isSatellite ? "Satélite" : "Mapa";
    });

    map.controls[google.maps.ControlPosition.TOP_RIGHT].push(btn);
  }

  return { loadGoogleMaps, MAP_STYLE, haversineKm, computeIsochrone, ISOCHRONE_MINUTES, addMapTypeToggle };
})();
