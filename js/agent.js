(() => {
  // Maps JavaScript API key — safe to ship client-side, but restrict it by
  // HTTP referrer to this domain in Google Cloud Console, and make sure both
  // "Maps JavaScript API" and "Geocoding API" are enabled on the project.
  const GOOGLE_MAPS_API_KEY = "AIzaSyCp6hfATMHB75MEv_werB1IV5yNUjTu1vM";

  const QUESTIONS = [
    {
      key: "familySize",
      text:
        "¡Hola! Soy el asistente de FUTURA. Te voy a hacer algunas preguntas para entender cómo vive tu familia y así encontrarte los proyectos que realmente encajan con vos.\n\n¿Cuántas personas conforman tu núcleo familiar?",
      type: "chips",
      options: ["1", "2", "3", "4", "5+"],
    },
    {
      key: "ages",
      text: "¿Qué edad tiene cada una de ellas?",
      type: "text",
      placeholder: "Ej: 38, 36, 9 y 6 años",
    },
    {
      key: "workLocations",
      text: "¿Dónde trabajan las personas que viven en tu hogar?",
      type: "textarea",
      placeholder: "Ej: Ella en Escazú, él trabaja remoto desde la casa",
      // Además del texto libre, intentamos ubicar cada lugar mencionado por
      // separado para que aparezcan como marcadores reales en el mapa —
      // misma fuente de datos que usa el filtro "Lugares de trabajo".
      geocodeMultiTarget: "workPlaces",
    },
    {
      key: "schools",
      text: "¿En qué colegio(s) estudian los niños o adolescentes de la familia?",
      type: "text",
      placeholder: "Ej: Country Day School",
      geocodeMultiTarget: "schoolPlaces",
    },
    {
      key: "activities",
      text: "¿Qué actividades extracurriculares realiza tu familia durante una semana típica?",
      type: "textarea",
      placeholder: "Ej: Fútbol los martes, natación los jueves...",
    },
    {
      key: "weekend",
      text: "¿Cómo describirías un fin de semana ideal para tu familia?",
      type: "textarea",
      placeholder: "Ej: Ir a la playa, comer afuera, caminar en un parque...",
    },
    {
      key: "zone",
      text: "¿En qué zona de Costa Rica preferirían vivir?",
      type: "text",
      placeholder: "Ej: Escazú, Santa Ana, Curridabat...",
      geocode: true,
    },
    {
      key: "income",
      text: "¿Cuál es el rango de ingresos mensuales de tu familia?",
      type: "chips",
      options: ["Menos de $1,500", "$1,500 – $3,000", "$3,000 – $5,000", "$5,000 – $8,000", "Más de $8,000"],
    },
    {
      key: "budget",
      text: "¿Qué rango de inversión han considerado para la compra de una propiedad?",
      type: "chips",
      options: ["Menos de $150,000", "$150,000 – $250,000", "$250,000 – $400,000", "$400,000 – $600,000", "Más de $600,000"],
    },
  ];

  const overlay = document.getElementById("agent-overlay");
  const openBtn = document.getElementById("open-agent-btn");
  const closeBtn = document.getElementById("agent-close");
  const chatEl = document.getElementById("agent-chat");
  const inputArea = document.getElementById("agent-input-area");
  const composer = document.getElementById("agent-composer");
  const progressBar = document.getElementById("agent-progress-bar");
  const progressLabel = document.getElementById("agent-progress-label");

  if (!overlay || !openBtn) return;

  let stepIndex = 0;
  let answers = {};
  let mapsLoadPromise = null;
  let started = false;
  let lastFocused = null;

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

  function geocodeZone(query) {
    return loadGoogleMaps()
      .then(
        () =>
          new Promise((resolve) => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ address: `${query}, Costa Rica` }, (results, status) => {
              if (status === "OK" && results && results[0]) {
                const r = results[0];
                resolve({
                  formattedAddress: r.formatted_address,
                  lat: r.geometry.location.lat(),
                  lng: r.geometry.location.lng(),
                });
              } else {
                resolve(null);
              }
            });
          })
      )
      .catch(() => null);
  }

  // El agente recolecta trabajo/colegios como prosa libre (puede describir
  // varios lugares en una sola respuesta) — partimos por separadores obvios
  // y geocodificamos cada fragmento por su cuenta, quedándonos solo con los
  // que efectivamente se pudieron ubicar.
  function splitLocationText(text) {
    return text
      .split(/,|;|\by\b|\n/i)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 4);
  }

  function geocodeMultiple(text) {
    const segments = splitLocationText(text);
    if (!segments.length) return Promise.resolve([]);
    return Promise.all(segments.map((seg) => geocodeZone(seg))).then((results) =>
      results
        .map((geo) => (geo ? { label: geo.formattedAddress, lat: geo.lat, lng: geo.lng } : null))
        .filter(Boolean)
    );
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

  function updateProgress() {
    const total = QUESTIONS.length;
    const current = Math.min(stepIndex + 1, total);
    progressBar.style.width = (Math.min(stepIndex, total) / total) * 100 + "%";
    progressLabel.textContent = stepIndex < total ? "Pregunta " + current + " de " + total : "Perfil completo";
  }

  function renderInput(question) {
    inputArea.innerHTML = "";

    if (question.type === "chips") {
      const wrap = document.createElement("div");
      wrap.className = "agent-chips";
      question.options.forEach((opt) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "agent-chip";
        chip.textContent = opt;
        chip.addEventListener("click", () => submitAnswer(opt));
        wrap.appendChild(chip);
      });
      inputArea.appendChild(wrap);
      return;
    }

    const field = question.type === "textarea" ? document.createElement("textarea") : document.createElement("input");
    if (question.type !== "textarea") field.type = "text";
    field.placeholder = question.placeholder || "Escribí tu respuesta...";
    field.required = true;

    const sendBtn = document.createElement("button");
    sendBtn.type = "submit";
    sendBtn.className = "agent-send";
    sendBtn.setAttribute("aria-label", "Enviar respuesta");
    sendBtn.textContent = "→";

    inputArea.appendChild(field);
    inputArea.appendChild(sendBtn);
    field.focus();

    composer.onsubmit = (e) => {
      e.preventDefault();
      const value = field.value.trim();
      if (!value) return;
      submitAnswer(value);
    };
  }

  function askQuestion() {
    updateProgress();
    const question = QUESTIONS[stepIndex];
    const typing = showTyping();
    setTimeout(() => {
      typing.remove();
      addBubble(question.text, "bot");
      renderInput(question);
    }, 450 + Math.random() * 300);
  }

  function submitAnswer(value) {
    const question = QUESTIONS[stepIndex];
    answers[question.key] = value;
    addBubble(value, "user");
    inputArea.innerHTML = "";

    if (question.geocode) {
      const typing = showTyping();
      geocodeZone(value).then((geo) => {
        typing.remove();
        if (geo) {
          answers.zoneGeo = geo;
          addBubble("📍 Ubiqué tu zona: " + geo.formattedAddress, "bot", true);
        } else {
          addBubble("Tomé nota de esa zona, aunque no pude ubicarla con precisión.", "bot", true);
        }
        advance();
      });
    } else if (question.geocodeMultiTarget) {
      const typing = showTyping();
      geocodeMultiple(value).then((places) => {
        typing.remove();
        answers[question.geocodeMultiTarget] = places;
        if (places.length) {
          addBubble("📍 Ubiqué " + places.length + " lugar(es): " + places.map((p) => p.label).join(", "), "bot", true);
        } else {
          addBubble("Tomé nota, aunque no pude ubicar una dirección exacta ahí.", "bot", true);
        }
        advance();
      });
    } else {
      advance();
    }
  }

  function advance() {
    stepIndex += 1;
    if (stepIndex >= QUESTIONS.length) {
      finish();
    } else {
      askQuestion();
    }
  }

  function finish() {
    updateProgress();
    inputArea.innerHTML = "";
    const typing = showTyping();
    setTimeout(() => {
      typing.remove();
      addBubble(
        "¡Perfecto! Ya tengo tu perfil de vida completo. Estoy lista para mostrarte los proyectos que encajan con vos.",
        "bot"
      );

      const finalWrap = document.createElement("div");
      finalWrap.className = "agent-final";

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-primary";
      btn.textContent = "Estás listo para conocer tu nuevo hogar";
      btn.addEventListener("click", handleComplete);

      finalWrap.appendChild(btn);
      inputArea.appendChild(finalWrap);
      scrollChatToBottom();
    }, 550);
  }

  function handleComplete() {
    try {
      localStorage.setItem("futuraUserProfile", JSON.stringify(answers));
    } catch (e) {
      /* localStorage puede no estar disponible (ej. modo privado); no es crítico */
    }
    inputArea.innerHTML = "";
    addBubble("¡Listo! Preparando tu mapa de proyectos...", "bot", true);
    setTimeout(() => {
      // El ?from=agente es lo que le dice a resultados.html que puede mostrar
      // la información del perfil (núcleo familiar, ingresos, prefills) — si
      // se llega ahí por cualquier otro camino, esa info no debe aparecer.
      window.location.href = "resultados.html?from=agente";
    }, 700);
  }

  function resetChat() {
    stepIndex = 0;
    answers = {};
    chatEl.innerHTML = "";
    inputArea.innerHTML = "";
  }

  function openModal() {
    lastFocused = document.activeElement;
    overlay.hidden = false;
    document.body.style.overflow = "hidden";
    if (!started) {
      started = true;
      resetChat();
      askQuestion();
    }
    closeBtn.focus();
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
