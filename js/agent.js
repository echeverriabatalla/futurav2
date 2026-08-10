(() => {
  // Maps JavaScript API key — safe to ship client-side, pero restringida por
  // HTTP referrer a este dominio en Google Cloud Console. Se usa solo para
  // geocodificar los lugares (trabajo, colegio, zona) que la persona
  // menciona en la charla.
  const GOOGLE_MAPS_API_KEY = "AIzaSyCp6hfATMHB75MEv_werB1IV5yNUjTu1vM";

  // La conversación en sí corre contra un proxy server-side que hace de
  // intermediario hacia la API de Claude — la API key de Anthropic vive
  // solo ahí, nunca en este archivo. En localhost usa el servidor de
  // desarrollo (server/dev-server.js); en cualquier otro dominio usa la
  // Supabase Edge Function (ver supabase/functions/agente-chat).
  const AGENT_ENDPOINT = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? "/api/agente-chat"
    : "https://eapjmqjnnonbdggzxptz.supabase.co/functions/v1/agente-chat";

  const GREETING =
    "¡Hola! Soy el asesor de estilo de vida de FUTURA. Contame un poco sobre cómo vive tu familia — dónde trabajan, si tienen chicos y en qué colegio están, cómo son sus fines de semana — y te voy guiando desde ahí. ¿Por dónde querés empezar?";

  // Campos que más ayudan a filtrar proyectos y ubicar cosas en el mapa —
  // se usan solo para la barra de progreso, no limitan de qué se puede
  // hablar.
  const PRIORITY_FIELDS = ["lugar_trabajo", "destino_fin_de_semana", "transporte", "zona_preferida", "presupuesto_compra"];

  const overlay = document.getElementById("agent-overlay");
  const openBtn = document.getElementById("open-agent-btn");
  const closeBtn = document.getElementById("agent-close");
  const chatEl = document.getElementById("agent-chat");
  const composer = document.getElementById("agent-composer");
  const textInput = document.getElementById("agent-text-input");
  const sendBtn = document.getElementById("agent-send-btn");
  const progressBar = document.getElementById("agent-progress-bar");
  const progressLabel = document.getElementById("agent-progress-label");
  const ctaBox = document.getElementById("agent-cta");
  const ctaBtn = document.getElementById("agent-cta-btn");

  if (!overlay || !openBtn) return;

  let started = false;
  let lastFocused = null;
  let sending = false;
  let mapsLoadPromise = null;

  // Historial en formato "wire" de la API de Claude — se manda completo en
  // cada turno (la API es stateless) y el servidor nos devuelve la versión
  // actualizada (incluye los turnos de tool_use/tool_result que el
  // servidor generó, que hay que reenviar tal cual).
  let messages = [];

  // Perfil estructurado acumulado, reconstruido en cada respuesta a partir
  // de todos los guardar_criterio_usuario que hizo el servidor — no se
  // arma incrementalmente en el cliente para no duplicar la fuente de
  // verdad.
  let criteria = [];
  const geocodedPlaces = {}; // texto normalizado -> {label, lat, lng} | null (en curso)
  let workPlaces = [];
  let schoolPlaces = [];
  let zoneGeo = null;

  function loadGoogleMaps() {
    if (window.google && window.google.maps) return Promise.resolve();
    if (mapsLoadPromise) return mapsLoadPromise;
    mapsLoadPromise = new Promise((resolve, reject) => {
      const callbackName = "__futuraMapsReady";
      window[callbackName] = () => resolve();
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return mapsLoadPromise;
  }

  function geocode(query) {
    return loadGoogleMaps()
      .then(
        () =>
          new Promise((resolve) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: `${query}, Costa Rica` }, (results, status) => {
              if (status === "OK" && results && results[0]) {
                const r = results[0];
                resolve({ label: r.formatted_address, lat: r.geometry.location.lat(), lng: r.geometry.location.lng() });
              } else {
                resolve(null);
              }
            });
          })
      )
      .catch(() => null);
  }

  function normalizeKey(text) {
    return text.trim().toLowerCase();
  }

  function scrollChatToBottom() {
    chatEl.scrollTop = chatEl.scrollHeight;
  }

  function addBubble(text, from, isNote) {
    const bubble = document.createElement("div");
    bubble.className = "agent-bubble " + from + (isNote ? " agent-note" : "");
    bubble.textContent = text;
    chatEl.appendChild(bubble);
    scrollChatToBottom();
    return bubble;
  }

  function showTyping() {
    const typing = document.createElement("div");
    typing.className = "agent-typing";
    typing.innerHTML = "<span></span><span></span><span></span>";
    chatEl.appendChild(typing);
    scrollChatToBottom();
    return typing;
  }

  function setSending(value) {
    sending = value;
    textInput.disabled = value;
    sendBtn.disabled = value;
  }

  // --- Perfil estructurado: agrupar los criterios que devuelve el
  // servidor y disparar la geocodificación de los lugares nuevos. ---

  function groupCriteria(list) {
    const grouped = {
      lugar_trabajo: [],
      colegio: [],
      destino_fin_de_semana: [],
      actividad_extracurricular: [],
    };
    const latest = {};
    list.forEach((c) => {
      if (!c || !c.campo || !c.texto) return;
      switch (c.campo) {
        case "lugar_trabajo":
        case "colegio":
        case "destino_fin_de_semana":
        case "actividad_extracurricular":
          if (!grouped[c.campo].some((t) => normalizeKey(t) === normalizeKey(c.texto))) {
            grouped[c.campo].push(c.texto);
          }
          break;
        case "tamano_familia":
          latest.tamano_familia = typeof c.cantidad_personas === "number" ? c.cantidad_personas : c.texto;
          break;
        case "presupuesto_compra":
        case "ingresos_mensuales":
          latest[c.campo] = typeof c.monto_usd === "number" ? c.monto_usd : c.texto;
          break;
        default:
          // edades, transporte, zona_preferida: se queda con el valor más
          // reciente (la persona puede corregirse durante la charla).
          latest[c.campo] = c.texto;
          break;
      }
    });
    return Object.assign({}, grouped, latest);
  }

  function geocodePlacesFor(texts) {
    const pending = texts.filter((t) => !(normalizeKey(t) in geocodedPlaces));
    if (!pending.length) return Promise.resolve();
    pending.forEach((t) => {
      geocodedPlaces[normalizeKey(t)] = null; // marca "en curso" para no pedirlo dos veces
    });
    return Promise.all(pending.map((t) => geocode(t).then((geo) => ({ text: t, geo })))).then((results) => {
      results.forEach(({ text, geo }) => {
        geocodedPlaces[normalizeKey(text)] = geo ? { label: geo.label, lat: geo.lat, lng: geo.lng } : false;
      });
    });
  }

  function placesFor(texts) {
    return texts.map((t) => geocodedPlaces[normalizeKey(t)]).filter((g) => g && g !== false);
  }

  function applyCriteria(list) {
    criteria = groupCriteria(list);

    const toGeocode = [].concat(criteria.lugar_trabajo, criteria.colegio, criteria.zona_preferida ? [criteria.zona_preferida] : []);

    return geocodePlacesFor(toGeocode).then(() => {
      workPlaces = placesFor(criteria.lugar_trabajo);
      schoolPlaces = placesFor(criteria.colegio);
      zoneGeo = criteria.zona_preferida ? placesFor([criteria.zona_preferida])[0] || null : null;
      updateProgress();
      updateCta();
    });
  }

  function updateProgress() {
    const filled = PRIORITY_FIELDS.filter((f) => {
      if (f === "lugar_trabajo") return criteria.lugar_trabajo && criteria.lugar_trabajo.length;
      if (f === "destino_fin_de_semana") return criteria.destino_fin_de_semana && criteria.destino_fin_de_semana.length;
      return criteria[f] != null && criteria[f] !== "";
    }).length;
    const total = PRIORITY_FIELDS.length;
    progressBar.style.width = (filled / total) * 100 + "%";
    progressLabel.textContent = filled >= total ? "Ya tengo un buen perfil de tu familia" : filled + " de " + total + " datos captados";
  }

  function updateCta() {
    const hasAnything =
      (criteria.lugar_trabajo && criteria.lugar_trabajo.length) ||
      (criteria.destino_fin_de_semana && criteria.destino_fin_de_semana.length) ||
      criteria.zona_preferida ||
      criteria.presupuesto_compra != null;
    ctaBox.hidden = !hasAnything;
  }

  // --- Conversación ---

  function sendToAgent(userText) {
    addBubble(userText, "user");
    messages.push({ role: "user", content: userText });
    setSending(true);
    const typing = showTyping();

    fetch(AGENT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("bad_status");
        return res.json();
      })
      .then((data) => {
        typing.remove();
        messages = Array.isArray(data.messages) ? data.messages : messages;
        return applyCriteria(Array.isArray(data.criteria) ? data.criteria : []).then(() => {
          addBubble(data.reply || "¿Podés contarme un poco más?", "bot");
          setSending(false);
          textInput.focus();
        });
      })
      .catch(() => {
        typing.remove();
        addBubble("Uy, tuve un problema para responder. ¿Podés intentar de nuevo?", "bot", true);
        setSending(false);
        textInput.focus();
      });
  }

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    if (sending) return;
    const value = textInput.value.trim();
    if (!value) return;
    textInput.value = "";
    sendToAgent(value);
  });

  // --- Cerrar la charla y pasar a resultados ---

  function buildProfile() {
    const profile = {};
    if (criteria.tamano_familia != null) {
      profile.familySize =
        typeof criteria.tamano_familia === "number"
          ? criteria.tamano_familia >= 5
            ? "5+"
            : String(criteria.tamano_familia)
          : criteria.tamano_familia;
    }
    if (criteria.edades) profile.ages = criteria.edades;
    if (criteria.lugar_trabajo && criteria.lugar_trabajo.length) profile.workLocations = criteria.lugar_trabajo.join(", ");
    if (workPlaces.length) profile.workPlaces = workPlaces;
    if (criteria.colegio && criteria.colegio.length) profile.schools = criteria.colegio.join(", ");
    if (schoolPlaces.length) profile.schoolPlaces = schoolPlaces;
    if (criteria.actividad_extracurricular && criteria.actividad_extracurricular.length) {
      profile.activities = criteria.actividad_extracurricular.join(", ");
    }
    if (criteria.destino_fin_de_semana && criteria.destino_fin_de_semana.length) {
      profile.weekend = criteria.destino_fin_de_semana.join(", ");
    }
    if (criteria.transporte) profile.transport = criteria.transporte;
    if (criteria.zona_preferida) profile.zone = criteria.zona_preferida;
    if (zoneGeo) profile.zoneGeo = zoneGeo;
    if (criteria.ingresos_mensuales != null) {
      profile.income =
        typeof criteria.ingresos_mensuales === "number"
          ? "$" + criteria.ingresos_mensuales.toLocaleString("en-US") + "/mes"
          : criteria.ingresos_mensuales;
    }
    if (criteria.presupuesto_compra != null) {
      if (typeof criteria.presupuesto_compra === "number") {
        profile.budgetMax = criteria.presupuesto_compra;
      } else {
        profile.budget = criteria.presupuesto_compra;
      }
    }
    return profile;
  }

  function handleComplete() {
    try {
      localStorage.setItem("futuraUserProfile", JSON.stringify(buildProfile()));
    } catch (e) {
      /* localStorage puede no estar disponible (ej. modo privado); no es crítico */
    }
    ctaBtn.disabled = true;
    addBubble("¡Listo! Preparando tu mapa de proyectos...", "bot", true);
    setTimeout(() => {
      // El ?from=agente es lo que le dice a resultados.html que puede mostrar
      // la información del perfil (núcleo familiar, ingresos, prefills) — si
      // se llega ahí por cualquier otro camino, esa info no debe aparecer.
      window.location.href = "resultados.html?from=agente";
    }, 500);
  }

  ctaBtn.addEventListener("click", handleComplete);

  // --- Abrir / cerrar el modal ---

  function resetChat() {
    messages = [];
    criteria = [];
    workPlaces = [];
    schoolPlaces = [];
    zoneGeo = null;
    Object.keys(geocodedPlaces).forEach((k) => delete geocodedPlaces[k]);
    chatEl.innerHTML = "";
    textInput.value = "";
    ctaBox.hidden = true;
    ctaBtn.disabled = false;
    updateProgress();
    addBubble(GREETING, "bot");
  }

  function openModal() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (!started) {
      started = true;
      resetChat();
    }
    textInput.focus();
    document.addEventListener("keydown", onKeydown);
  }

  function closeModal() {
    overlay.hidden = true;
    document.body.style.overflow = "";
    document.removeEventListener("keydown", onKeydown);
    if (lastFocused) lastFocused.focus();
  }

  function onKeydown(e) {
    if (e.key === "Escape") closeModal();
  }

  openBtn.addEventListener("click", openModal);
  closeBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeModal();
  });
})();
