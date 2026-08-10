#!/usr/bin/env node
// Servidor local para probar el agente conversacional sin desplegar la
// Supabase Edge Function todavía. Sirve el sitio estático y expone
// POST /api/agente-chat con la misma lógica que
// supabase/functions/agente-chat/index.ts (mismo prompt, misma tool, mismo
// loop de tool use) — la única diferencia es dónde corre: acá vive en tu
// máquina en vez de en Supabase, así que la ANTHROPIC_API_KEY solo existe
// como variable de entorno local y nunca queda en un archivo del repo.
//
// Uso:
//   ANTHROPIC_API_KEY=sk-ant-... node server/dev-server.js
// Después abrí http://localhost:8000 — no abras index.html directo desde el
// disco (file://); el chat necesita que el sitio se sirva desde este mismo
// servidor para que /api/agente-chat funcione (mismo origen, sin CORS).
//
// Solo para desarrollo local. js/agent.js usa este endpoint automáticamente
// cuando el sitio corre en localhost/127.0.0.1, y la Edge Function de
// Supabase en cualquier otro dominio — no hace falta tocar nada al pasar de
// uno a otro.

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || 8000;
const ROOT = path.resolve(__dirname, "..");
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
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

function sanitizeIncomingMessages(input) {
  if (!Array.isArray(input) || !input.length || input.length > MAX_MESSAGES) return null;
  const out = [];
  for (const m of input) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) return null;
    if (typeof m.content === "string") {
      out.push({ role: m.role, content: m.content.slice(0, MAX_USER_MESSAGE_CHARS) });
    } else if (Array.isArray(m.content)) {
      out.push({ role: m.role, content: m.content });
    } else {
      return null;
    }
  }
  if (out[0].role !== "user") return null;
  return out;
}

function normalizeCriterion(input) {
  if (!input || typeof input.campo !== "string" || !CRITERIA_FIELDS.includes(input.campo)) return null;
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

function extractCriteria(messages) {
  const out = [];
  for (const m of messages) {
    if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
    for (const block of m.content) {
      if (block && block.type === "tool_use" && block.name === CRITERIA_TOOL_NAME) {
        const criterion = normalizeCriterion(block.input);
        if (criterion) out.push(criterion);
      }
    }
  }
  return out;
}

function callClaude(messages) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
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

function countUserTurns(messages) {
  return messages.filter((m) => m.role === "user" && typeof m.content === "string").length;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        req.destroy();
        reject(new Error("payload_too_large"));
      }
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

async function handleAgentChat(req, res) {
  if (!ANTHROPIC_API_KEY) {
    return sendJson(res, 500, { error: "server_misconfigured" });
  }

  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "invalid_json" });
  }

  let messages = sanitizeIncomingMessages(body && body.messages);
  if (!messages) return sendJson(res, 400, { error: "invalid_messages" });

  // Corta acá, sin llamar a la API: esto es lo que realmente evita el
  // abuso (el chequeo del lado del cliente en agent.js es solo para
  // mostrar el aviso — el gasto real se frena acá). Responde 200 con un
  // mensaje conversacional en vez de un error, para que se vea como una
  // respuesta normal del asistente y no dispare el flujo de reintento/
  // modo local del cliente.
  if (countUserTurns(messages) > MAX_USER_TURNS_PER_SESSION) {
    return sendJson(res, 200, {
      reply:
        "Llegamos al límite de mensajes para esta conversación. Con lo que ya charlamos tengo suficiente para mostrarte proyectos — si querés seguir contándome, abrí el chat de nuevo más tarde.",
      messages,
      criteria: extractCriteria(messages),
      limitReached: true,
    });
  }

  for (let i = 0; i < MAX_TOOL_ITERATIONS; i++) {
    let response;
    try {
      response = await callClaude(messages);
    } catch (err) {
      console.error("anthropic_fetch_failed", err);
      return sendJson(res, 502, { error: "upstream_unreachable" });
    }

    if (!response.ok) {
      console.error("anthropic_error", response.status, await response.text());
      return sendJson(res, 502, { error: "upstream_error" });
    }

    const data = await response.json();
    messages = messages.concat([{ role: "assistant", content: data.content }]);

    if (data.stop_reason !== "tool_use") {
      const reply = (data.content || [])
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n\n")
        .trim();
      return sendJson(res, 200, { reply, messages, criteria: extractCriteria(messages) });
    }

    const toolResults = [];
    for (const block of data.content) {
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
    messages = messages.concat([{ role: "user", content: toolResults }]);
  }

  console.error("too_many_tool_iterations");
  return sendJson(res, 502, { error: "too_many_tool_iterations" });
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.normalize(path.join(ROOT, urlPath));

  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      return res.end("No encontrado");
    }
    const ext = path.extname(filePath);
    res.writeHead(200, { "content-type": MIME_TYPES[ext] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  if (req.method === "POST" && req.url === "/api/agente-chat") {
    handleAgentChat(req, res).catch((err) => {
      console.error(err);
      sendJson(res, 500, { error: "internal_error" });
    });
    return;
  }
  if (req.method === "GET" || req.method === "HEAD") {
    return serveStatic(req, res);
  }
  res.writeHead(405);
  res.end("Method not allowed");
});

server.listen(PORT, () => {
  if (!ANTHROPIC_API_KEY) {
    console.warn("⚠️  ANTHROPIC_API_KEY no está configurada — el chat va a fallar.");
    console.warn("    Corré en su lugar: ANTHROPIC_API_KEY=sk-ant-... node server/dev-server.js");
  }
  console.log(`FUTURA corriendo en http://localhost:${PORT}`);
});
