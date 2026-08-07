// Auth simulado (mockup) para probar el flujo de guardado sin depender de
// una red real todavía — implementa la misma interfaz que window.FuturaAuth
// en js/supabase-client.js, así que ningún otro archivo necesita cambios.
//
// Para volver a la cuenta real de Supabase más adelante: en proyecto.html y
// mi-cuenta/comparar.html, cambiá el <script src="js/mock-auth.js"> por
// <script src="js/supabase-client.js">.
//
// "Iniciar sesión" acepta cualquier correo/contraseña (min. 6 caracteres) y
// crea una sesión falsa guardada en localStorage; las tipologías guardadas
// también quedan en localStorage, no en una base de datos real.
window.FuturaAuth = (() => {
  const SESSION_KEY = "futuraMockSession";
  const SAVED_KEY = "futuraMockSaved";
  const NETWORK_DELAY_MS = 450;

  function delay(value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
  }

  function readSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function writeSession(session) {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  }

  function readSaved() {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeSaved(rows) {
    localStorage.setItem(SAVED_KEY, JSON.stringify(rows));
  }

  function makeUser(email) {
    const id = "mock-" + btoa(unescape(encodeURIComponent(email.toLowerCase()))).replace(/=+$/, "");
    return { id, email };
  }

  function getSession() {
    return delay(readSession());
  }

  function getUser() {
    return getSession().then((session) => (session ? session.user : null));
  }

  function onAuthChange() {
    /* no hace falta para el mockup: cada página relee el estado al cargar */
  }

  function signUp(email, password) {
    if (!password || password.length < 6) {
      return delay({ data: {}, error: { message: "Password should be at least 6 characters." } });
    }
    const session = { user: makeUser(email) };
    writeSession(session);
    return delay({ data: { session, user: session.user }, error: null });
  }

  function signIn(email, password) {
    if (!email || !password) {
      return delay({ data: {}, error: { message: "Invalid login credentials" } });
    }
    const session = { user: makeUser(email) };
    writeSession(session);
    return delay({ data: { session, user: session.user }, error: null });
  }

  function signOut() {
    writeSession(null);
    return delay({ error: null });
  }

  function saveTypology(projectId, typologyId) {
    return getUser().then((user) => {
      if (!user) throw new Error("not authenticated");
      const rows = readSaved();
      const exists = rows.some(
        (r) => r.user_id === user.id && r.project_id === projectId && r.typology_id === typologyId
      );
      if (!exists) {
        rows.push({
          id: "mock-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
          user_id: user.id,
          project_id: projectId,
          typology_id: typologyId,
          created_at: new Date().toISOString(),
        });
        writeSaved(rows);
      }
      return delay({ error: null });
    });
  }

  function removeTypology(projectId, typologyId) {
    return getUser().then((user) => {
      if (!user) throw new Error("not authenticated");
      writeSaved(
        readSaved().filter((r) => !(r.user_id === user.id && r.project_id === projectId && r.typology_id === typologyId))
      );
      return delay({ error: null });
    });
  }

  function removeById(id) {
    writeSaved(readSaved().filter((r) => r.id !== id));
    return delay({ error: null });
  }

  function listSaved() {
    return getUser().then((user) => {
      if (!user) return [];
      return readSaved()
        .filter((r) => r.user_id === user.id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    });
  }

  return {
    getClient: () => Promise.resolve(null),
    getSession,
    getUser,
    onAuthChange,
    signUp,
    signIn,
    signOut,
    saveTypology,
    removeTypology,
    removeById,
    listSaved,
  };
})();
