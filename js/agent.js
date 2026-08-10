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

  // Si ese backend todavía no está desplegado, ofrecemos un modo de prueba
  // que llama a la API de Claude directamente desde el navegador con una key
  // que la persona pega ella misma — solo para probar en la propia
  // computadora. La key vive únicamente en esta variable (nunca se guarda
  // en localStorage/sessionStorage ni se manda a ningún servidor nuestro) y
  // se pierde apenas se recarga la página. El prompt, la tool y el loop son
  // el mismo que corre en supabase/functions/agente-chat — acá simplemente
  // se ejecutan en el navegador en vez de en un servidor.
  const DIRECT_ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
  // Modelo económico: alcanza de sobra para esta charla guiada por tools, a
  // una fracción del costo de un modelo más grande. No soporta el
  // parámetro output_config.effort (por eso no aparece más abajo) ni
  // thinking adaptativo — no hace falta para este caso de uso.
  const CLAUDE_MODEL = "claude-haiku-4-5";
  // Tope alto del rango pedido (300–500): deja margen para una respuesta
  // completa sin dejar de forzar que sea corta — esto es un chat, no un
  // ensayo (el propio system prompt ya lo pide).
  const CLAUDE_MAX_TOKENS = 500;
  const MAX_DIRECT_TOOL_ITERATIONS = 6;
  // Mismo tope que el backend (ver supabase/functions/agente-chat) — acá
  // no protege nuestra cuota (la persona usa su propia key), pero mantiene
  // el comportamiento consistente y evita una conversación sin límite.
  const MAX_USER_TURNS_PER_SESSION = 20;
  const SESSION_LIMIT_MESSAGE =
    "Llegamos al límite de mensajes para esta conversación. Con lo que ya charlamos tengo suficiente para mostrarte proyectos — si querés seguir contándome, abrí el chat de nuevo más tarde.";
  const CRITERIA_TOOL_NAME = "guardar_criterio_usuario";
  const CRITERIA_FIELDS = [
    "tamano_familia",
    "edades",
    "lugar_trabajo",
    "colegio",
    "actividad_extracurricular",
    "destino_fin_de_semana",
    "transporte",
    "zona_preferida",
    "ingresos_mensuales",
    "presupuesto_compra",
  ];
  const AGENT_SYSTEM_PROMPT =
    "Sos el asesor de estilo de vida de FUTURA, una plataforma que ayuda a familias en Costa Rica a encontrar el proyecto residencial que mejor encaja con su vida real — no solo con su presupuesto.\n\n" +
    "Tu objetivo es tener una conversación natural y cálida, como la que tendrías con un asesor de confianza, para entender cómo vive la familia: dónde trabajan, dónde estudian sus hijos si los hay, cómo son sus fines de semana, cómo se transportan por la ciudad, y qué presupuesto manejan.\n\n" +
    "Cómo conversar:\n" +
    "- Hacé una pregunta genuina a la vez y reaccioná brevemente a lo que te cuentan antes de seguir — no dispares una lista de preguntas ni suene a formulario.\n" +
    "- Dejá que la persona cuente las cosas en el orden que le salga natural. Si ya mencionó algo de pasada, no se lo vuelvas a preguntar.\n" +
    "- Sé cálido, concreto y directo. Respuestas cortas — esto es un chat, no un ensayo.\n" +
    "- Priorizá entender: dónde trabaja la familia, dónde estudian los chicos (si aplica), cómo son sus fines de semana, cómo se transportan, y el presupuesto de compra. El tamaño de la familia, las edades y los ingresos ayudan si surgen naturalmente, pero no son obligatorios.\n" +
    "- En cuanto tengas una idea razonable del estilo de vida de la familia — aunque no sea perfecta ni completa — decíselo y ofrecé mostrarle los proyectos que podrían encajar.\n" +
    "- Si la persona ya te dijo que quiere ver los proyectos, no insistas con más preguntas.\n\n" +
    "Herramienta:\n" +
    "- Cada vez que la persona te dé un dato concreto y usable (un lugar de trabajo, un colegio, un destino de fin de semana, cómo se transportan, su presupuesto, sus ingresos, el tamaño de su familia, las edades), llamá a la herramienta " +
    CRITERIA_TOOL_NAME +
    " con ese dato — incluso si lo menciona de pasada. Podés llamarla varias veces en el mismo turno si mencionó varias cosas a la vez.\n" +
    "- Si la persona corrige un dato que ya guardaste, volvé a llamar la herramienta con el valor actualizado.\n" +
    '- Nunca le muestres a la persona que estás usando una herramienta ni hables de "guardar datos" — para ella esto es solo una conversación.';

  // El prompt cacheable es un bloque de texto con cache_control en vez de
  // un string plano — es la única forma de marcar un breakpoint de
  // caching. El mínimo cacheable en Haiku 4.5 es 4096 tokens y este prompt
  // + la tool quedan muy por debajo, así que hoy no genera hits — queda
  // listo para cuando el prompt crezca o se cambie de modelo.
  const AGENT_SYSTEM_BLOCKS = [{ type: "text", text: AGENT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];

  const CRITERIA_TOOL = {
    name: CRITERIA_TOOL_NAME,
    description:
      "Guarda un dato concreto sobre el estilo de vida o presupuesto de la familia, mencionado en la conversación, para usarlo después en el mapa y los filtros de búsqueda de FUTURA. Llamar cada vez que se identifique un dato nuevo o corregido — no esperar a tener el perfil completo.",
    input_schema: {
      type: "object",
      properties: {
        campo: { type: "string", enum: CRITERIA_FIELDS, description: "Qué tipo de dato es." },
        texto: {
          type: "string",
          description:
            "El dato tal como lo mencionó la persona, en sus propias palabras (ej. 'Escazú', 'Country Day School', 'la playa los fines de semana', 'carro propio').",
        },
        monto_usd: {
          type: "number",
          description:
            "Solo para 'ingresos_mensuales' o 'presupuesto_compra': el monto en dólares. Si mencionó un rango, usar el valor más alto del rango.",
        },
        cantidad_personas: {
          type: "integer",
          description: "Solo para 'tamano_familia': el número de personas en el núcleo familiar.",
        },
      },
      required: ["campo", "texto"],
    },
  };

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
  let sessionLimitReached = false;
  let mapsLoadPromise = null;

  // Key de Anthropic pegada por la persona para el modo de prueba directo
  // en el navegador — null hasta que haga falta (ver comentario arriba).
  let directApiKey = null;

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
    textInput.disabled = value || sessionLimitReached;
    sendBtn.disabled = value || sessionLimitReached;
  }

  // Se llama cuando el backend (o el modo directo) avisa que se llegó al
  // límite de mensajes de la sesión — deja el composer inhabilitado para
  // siempre en esta conversación, en vez de solo mostrar el aviso una vez.
  function lockComposer() {
    sessionLimitReached = true;
    textInput.disabled = true;
    sendBtn.disabled = true;
    textInput.placeholder = "Alcanzaste el límite de mensajes de esta conversación";
  }

  // --- Modo de prueba: llamar a Claude directo desde el navegador con la
  // key que pegó la persona, replicando el mismo prompt/tool/loop que corre
  // en supabase/functions/agente-chat. Solo se usa si el backend normal
  // (AGENT_ENDPOINT) no responde. ---

  function normalizeCriterionInput(input) {
    if (!input || typeof input.campo !== "string" || CRITERIA_FIELDS.indexOf(input.campo) === -1) return null;
    if (typeof input.texto !== "string" || !input.texto.trim()) return null;
    const criterion = { campo: input.campo, texto: input.texto.trim().slice(0, 300) };
    if (typeof input.monto_usd === "number" && isFinite(input.monto_usd) && input.monto_usd > 0) {
      criterion.monto_usd = input.monto_usd;
    }
    if (typeof input.cantidad_personas === "number" && isFinite(input.cantidad_personas) && input.cantidad_personas > 0) {
      criterion.cantidad_personas = Math.round(input.cantidad_personas);
    }
    return criterion;
  }

  function extractCriteriaFromMessages(msgs) {
    const out = [];
    msgs.forEach((m) => {
      if (m.role !== "assistant" || !Array.isArray(m.content)) return;
      m.content.forEach((block) => {
        if (block && block.type === "tool_use" && block.name === CRITERIA_TOOL_NAME) {
          const criterion = normalizeCriterionInput(block.input);
          if (criterion) out.push(criterion);
        }
      });
    });
    return out;
  }

  function countUserTurns(msgs) {
    return msgs.filter((m) => m.role === "user" && typeof m.content === "string").length;
  }

  function runAgentTurnDirect(apiKey, initialMessages) {
    // Corta acá, sin llamar a la API: mismo comportamiento que el backend
    // para esta conversación, aunque acá la key sea de la propia persona.
    if (countUserTurns(initialMessages) > MAX_USER_TURNS_PER_SESSION) {
      return Promise.resolve({
        reply: SESSION_LIMIT_MESSAGE,
        messages: initialMessages,
        criteria: extractCriteriaFromMessages(initialMessages),
        limitReached: true,
      });
    }

    let msgs = initialMessages.slice();
    let iterations = 0;

    function step() {
      iterations += 1;
      if (iterations > MAX_DIRECT_TOOL_ITERATIONS) {
        return Promise.reject(new Error("too_many_tool_iterations"));
      }
      return fetch(DIRECT_ANTHROPIC_ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          // Anthropic bloquea llamadas directas desde el navegador salvo que
          // se pida explícitamente con este header — es una barrera a
          // propósito, porque exponer la key en el navegador es inseguro
          // fuera de un uso de prueba como este.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: CLAUDE_MODEL,
          max_tokens: CLAUDE_MAX_TOKENS,
          system: AGENT_SYSTEM_BLOCKS,
          tools: [CRITERIA_TOOL],
          messages: msgs,
        }),
      })
        .then((res) => {
          if (res.ok) return res.json();
          return res
            .json()
            .catch(() => null)
            .then((err) => {
              const message = err && err.error && err.error.message;
              throw new Error(message || "anthropic_error_" + res.status);
            });
        })
        .then((data) => {
          msgs = msgs.concat([{ role: "assistant", content: data.content }]);

          if (data.stop_reason !== "tool_use") {
            const reply = (data.content || [])
              .filter((b) => b.type === "text")
              .map((b) => b.text)
              .join("\n\n")
              .trim();
            return { reply: reply, messages: msgs, criteria: extractCriteriaFromMessages(msgs) };
          }

          const toolResults = [];
          (data.content || []).forEach((block) => {
            if (block.type !== "tool_use") return;
            if (block.name === CRITERIA_TOOL_NAME) {
              toolResults.push({ type: "tool_result", tool_use_id: block.id, content: "Guardado." });
            } else {
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: "Herramienta desconocida.",
                is_error: true,
              });
            }
          });
          msgs = msgs.concat([{ role: "user", content: toolResults }]);
          return step();
        });
    }

    return step();
  }

  function showKeyGate(onSubmit) {
    const card = document.createElement("div");
    card.className = "agent-key-gate";
    card.innerHTML =
      '<p class="agent-key-gate-title">Probar el asesor (modo local)</p>' +
      '<p class="agent-key-gate-desc">El servidor todavía no está configurado. Pegá tu API key de Anthropic para probar el chat en este navegador — se usa solo en esta pestaña, no se guarda ni se manda a ningún servidor nuestro.</p>' +
      '<form class="agent-key-gate-form">' +
      '<input type="password" placeholder="sk-ant-..." autocomplete="off" />' +
      '<button type="submit" class="btn btn-primary btn-sm">Guardar y empezar</button>' +
      "</form>" +
      '<p class="agent-key-gate-warning">Solo para probar en tu computadora — nunca compartas ni publiques esta página con la key cargada.</p>';
    chatEl.appendChild(card);
    scrollChatToBottom();

    const form = card.querySelector("form");
    const input = card.querySelector("input");
    input.focus();
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const key = input.value.trim();
      if (!key) return;
      card.remove();
      onSubmit(key);
    });
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

  function sendToAgent(userText, isRetry) {
    if (!isRetry) {
      addBubble(userText, "user");
      messages.push({ role: "user", content: userText });
    }
    setSending(true);
    const typing = showTyping();

    const requestPromise = directApiKey
      ? runAgentTurnDirect(directApiKey, messages)
      : fetch(AGENT_ENDPOINT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages }),
        }).then((res) => {
          if (!res.ok) throw new Error("bad_status");
          return res.json();
        });

    requestPromise
      .then((data) => {
        typing.remove();
        messages = Array.isArray(data.messages) ? data.messages : messages;
        return applyCriteria(Array.isArray(data.criteria) ? data.criteria : []).then(() => {
          addBubble(data.reply || "¿Podés contarme un poco más?", "bot");
          if (data.limitReached) {
            lockComposer();
          } else {
            setSending(false);
            textInput.focus();
          }
        });
      })
      .catch(() => {
        typing.remove();
        if (!directApiKey) {
          // El backend (Supabase / servidor local) todavía no está
          // disponible — ofrecemos seguir la charla probando directo desde
          // el navegador con una key que la persona pegue ella misma.
          showKeyGate((key) => {
            directApiKey = key;
            setSending(false);
            sendToAgent(userText, true);
          });
          setSending(false);
        } else {
          addBubble("No pude conectarme con Claude. Revisá que la API key sea válida y tenga saldo, y probá de nuevo.", "bot", true);
          setSending(false);
          textInput.focus();
        }
      });
  }

  composer.addEventListener("submit", (e) => {
    e.preventDefault();
    if (sending || sessionLimitReached) return;
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
    sessionLimitReached = false;
    Object.keys(geocodedPlaces).forEach((k) => delete geocodedPlaces[k]);
    chatEl.innerHTML = "";
    textInput.value = "";
    textInput.disabled = false;
    textInput.placeholder = "Escribí tu respuesta...";
    sendBtn.disabled = false;
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
