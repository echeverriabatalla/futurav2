// Supabase Edge Function: proxy conversacional hacia la API de Claude.
//
// La app es un sitio estático sin servidor propio, así que esta función es
// el único lugar donde vive la API key de Anthropic — nunca se manda al
// navegador. El cliente (js/agent.js) le manda el historial de la
// conversación en cada turno; esta función llama a la Messages API, ejecuta
// el loop de tool use de "guardar_criterio_usuario" (guardar el dato y
// seguir), y devuelve la respuesta del asistente más el perfil estructurado
// acumulado hasta ahora, reconstruido directamente del historial de
// mensajes (no hay estado guardado en el servidor).
//
// Deploy:
//   supabase functions deploy agente-chat
//   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Deno.serve es el runtime nativo de Supabase Edge Functions.

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
// Modelo económico: alcanza de sobra para esta charla guiada por tools, a
// una fracción del costo de un modelo más grande. No soporta el parámetro
// output_config.effort (por eso no aparece en callClaude) ni thinking
// adaptativo — no hace falta para este caso de uso.
const MODEL = "claude-haiku-4-5";
// Tope alto del rango pedido (300–500): deja margen para una respuesta
// completa sin dejar de forzar que sea corta — esto es un chat, no un
// ensayo (el propio system prompt ya lo pide).
const MAX_TOKENS = 500;
const MAX_TOOL_ITERATIONS = 6;
const MAX_MESSAGES = 60;
const MAX_USER_MESSAGE_CHARS = 2000;
// Tope de turnos por conversación — evita que una sola sesión (o un abuso
// automatizado) genere de forma indefinida llamadas facturables a la API.
// Cuenta solo mensajes de usuario en texto libre, no los turnos de
// tool_result que el propio loop genera.
const MAX_USER_TURNS_PER_SESSION = 20;

// El sitio se sirve como GitHub Pages en estos orígenes (más localhost para
// desarrollo). Reflejar el Origin solo si matchea evita que un tercero
// embeba esta función en otro sitio y gaste la cuota de la API a costa
// nuestra.
const ALLOWED_ORIGINS = new Set([
  "https://echeverriabatalla.github.io",
  "http://localhost:8000",
  "http://127.0.0.1:8000",
]);

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

const SYSTEM_PROMPT = `Sos el asesor de estilo de vida de FUTURA, una plataforma que ayuda a familias en Costa Rica a encontrar el proyecto residencial que mejor encaja con su vida real — no solo con su presupuesto.

Tu objetivo es tener una conversación natural y cálida, como la que tendrías con un asesor de confianza, para entender cómo vive la familia: dónde trabajan, dónde estudian sus hijos si los hay, cómo son sus fines de semana, cómo se transportan por la ciudad, y qué presupuesto manejan.

Cómo conversar:
- Hacé una pregunta genuina a la vez y reaccioná brevemente a lo que te cuentan antes de seguir — no dispares una lista de preguntas ni suene a formulario.
- Dejá que la persona cuente las cosas en el orden que le salga natural. Si ya mencionó algo de pasada (por ejemplo, su trabajo mientras hablaba del presupuesto), no se lo vuelvas a preguntar.
- Sé cálido, concreto y directo. Respuestas cortas — esto es un chat, no un ensayo.
- Priorizá entender: dónde trabaja la familia, dónde estudian los chicos (si aplica), cómo son sus fines de semana, cómo se transportan, y el presupuesto de compra. El tamaño de la familia, las edades y los ingresos ayudan si surgen naturalmente, pero no son obligatorios.
- No hace falta cubrir cada tema en profundidad ni en un orden fijo. En cuanto tengas una idea razonable del estilo de vida de la familia — aunque no sea perfecta ni completa — decíselo y ofrecé mostrarle los proyectos que podrían encajar.
- Si la persona ya te dijo que quiere ver los proyectos, no insistas con más preguntas.

Herramienta:
- Cada vez que la persona te dé un dato concreto y usable (un lugar de trabajo, un colegio, un destino de fin de semana, cómo se transportan, su presupuesto, sus ingresos, el tamaño de su familia, las edades), llamá a la herramienta ${CRITERIA_TOOL_NAME} con ese dato — incluso si lo menciona de pasada. Podés llamarla varias veces en el mismo turno si mencionó varias cosas a la vez.
- Si la persona corrige un dato que ya guardaste, volvé a llamar la herramienta con el valor actualizado.
- Nunca le muestres a la persona que estás usando una herramienta ni hables de "guardar datos" — para ella esto es solo una conversación.`;

// El prompt cacheable es un bloque de texto con cache_control en vez de un
// string plano — es la única forma de marcar un breakpoint de caching. El
// orden de render de la API es tools → system → messages, así que este
// breakpoint (al final de system) cachea tools + system juntos; no hace
// falta un breakpoint separado en CRITERIA_TOOL. Dicho esto: el mínimo
// cacheable en Haiku 4.5 es 4096 tokens, y este prompt + la tool quedan muy
// por debajo — hoy este breakpoint no genera hits (cache_read_input_tokens
// siempre en 0), pero no hace daño dejarlo listo para cuando el prompt
// crezca o se cambie de modelo.
const SYSTEM_BLOCKS = [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }];

const CRITERIA_TOOL = {
  name: CRITERIA_TOOL_NAME,
  description:
    "Guarda un dato concreto sobre el estilo de vida o presupuesto de la familia, mencionado en la conversación, para usarlo después en el mapa y los filtros de búsqueda de FUTURA. Llamar cada vez que se identifique un dato nuevo o corregido — no esperar a tener el perfil completo.",
  input_schema: {
    type: "object",
    properties: {
      campo: {
        type: "string",
        enum: CRITERIA_FIELDS,
        description: "Qué tipo de dato es.",
      },
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

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...corsHeaders(origin) },
  });
}

type WireMessage = { role: "user" | "assistant"; content: unknown };

function sanitizeIncomingMessages(input: unknown): WireMessage[] | null {
  if (!Array.isArray(input) || !input.length || input.length > MAX_MESSAGES) return null;
  const out: WireMessage[] = [];
  for (const m of input) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content.slice(0, MAX_USER_MESSAGE_CHARS) });
    } else if (Array.isArray(m.content)) {
      // Turnos de tool_use/tool_result que esta misma función generó y le
      // devolvió al cliente en una respuesta anterior — se reenvían tal
      // cual para mantener la conversación coherente.
      out.push({ role: m.role, content: m.content });
    } else {
      return null;
    }
  }
  if (out[0].role !== "user") return null;
  return out;
}

function normalizeCriterion(input: any) {
  if (!input || typeof input.campo !== "string" || !CRITERIA_FIELDS.includes(input.campo)) return null;
  if (typeof input.texto !== "string" || !input.texto.trim()) return null;
  const criterion: Record<string, unknown> = { campo: input.campo, texto: input.texto.trim().slice(0, 300) };
  if (typeof input.monto_usd === "number" && isFinite(input.monto_usd) && input.monto_usd > 0) {
    criterion.monto_usd = input.monto_usd;
  }
  if (typeof input.cantidad_personas === "number" && isFinite(input.cantidad_personas) && input.cantidad_personas > 0) {
    criterion.cantidad_personas = Math.round(input.cantidad_personas);
  }
  return criterion;
}

function extractCriteria(messages: WireMessage[]) {
  const out: Record<string, unknown>[] = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const block of m.content as any[]) {
      if (block && block.type === "tool_use" && block.name === CRITERIA_TOOL_NAME) {
        const criterion = normalizeCriterion(block.input);
        if (criterion) out.push(criterion);
      }
    }
  }
  return out;
}

function callClaude(messages: WireMessage[]) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY as string,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_BLOCKS,
      tools: [CRITERIA_TOOL],
      messages,
    }),
  });
}

function countUserTurns(messages: WireMessage[]) {
  return messages.filter((m) => m.role === "user" && typeof m.content === "string").length;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, origin);
  }
  if (!ANTHROPIC_API_KEY) {
    console.error("ANTHROPIC_API_KEY no está configurada (supabase secrets set).");
    return json({ error: "server_misconfigured" }, 500, origin);
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400, origin);
  }

  let messages = sanitizeIncomingMessages(body?.messages);
  if (!messages) {
    return json({ error: "invalid_messages" }, 400, origin);
  }

  // Corta acá, sin llamar a la API: esto es lo que realmente evita el
  // abuso (el chequeo del lado del cliente en agent.js es solo para
  // mostrar el aviso — el gasto real se frena acá). Responde 200 con un
  // mensaje conversacional en vez de un error, para que se vea como una
  // respuesta normal del asistente y no dispare el flujo de reintento/
  // modo local del cliente.
  if (countUserTurns(messages) > MAX_USER_TURNS_PER_SESSION) {
    return json(
      {
        reply:
          "Llegamos al límite de mensajes para esta conversación. Con lo que ya charlamos tengo suficiente para mostrarte proyectos — si querés seguir contándome, abrí el chat de nuevo más tarde.",
        messages,
        criteria: extractCriteria(messages),
        limitReached: true,
      },
      200,
      origin
    );
  }

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let response: Response;
    try {
      response = await callClaude(messages);
    } catch (err) {
      console.error("anthropic_fetch_failed", err);
      return json({ error: "upstream_unreachable" }, 502, origin);
    }

    if (!response.ok) {
      console.error("anthropic_error", response.status, await response.text());
      return json({ error: "upstream_error" }, 502, origin);
    }

    const data = await response.json();
    messages = [...messages, { role: "assistant", content: data.content }];

    if (data.stop_reason !== "tool_use") {
      const reply = (data.content || [])
        .filter((b: any) => b.type === "text")
        .map((b: any) => b.text)
        .join("\n\n")
        .trim();
      return json({ reply, messages, criteria: extractCriteria(messages) }, 200, origin);
    }

    const toolResults = [];
    for (const block of data.content as any[]) {
      if (block.type !== "tool_use") continue;
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
    }
    messages = [...messages, { role: "user", content: toolResults }];
  }

  console.error("too_many_tool_iterations");
  return json({ error: "too_many_tool_iterations" }, 502, origin);
});
