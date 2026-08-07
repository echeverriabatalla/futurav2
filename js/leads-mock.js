// Envío de leads simulado (mockup). No existía todavía un flujo de
// leads/CRM real en la plataforma (solo links mailto sueltos en el sitio),
// así que este mock sigue el mismo patrón que js/mock-auth.js: misma forma
// de payload que tendría una integración real, guardado en localStorage en
// vez de mandarse a un backend. Cuando haya un CRM real, este es el único
// lugar que hay que cambiar (ver submit()).
window.FuturaLeads = (() => {
  const LEADS_KEY = "futuraMockLeads";
  const NETWORK_DELAY_MS = 500;

  function delay(value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
  }

  function readLeads() {
    try {
      const raw = localStorage.getItem(LEADS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  // payload: { profile, items } — items es un array (no un solo proyecto),
  // así una solicitud con varias tipologías comparadas genera un único
  // lead consolidado en vez de uno por proyecto.
  function submit(payload) {
    const leads = readLeads();
    const lead = {
      id: "lead-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      created_at: new Date().toISOString(),
      profile: payload.profile || null,
      items: payload.items || [],
    };
    leads.push(lead);
    try {
      localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
    } catch (e) {
      /* localStorage puede fallar (ej. modo privado); no bloquea la confirmación */
    }
    return delay({ error: null, lead });
  }

  return { submit };
})();
