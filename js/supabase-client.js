// Cliente de Supabase compartido: auth + persistencia de tipologías
// guardadas por usuario. La "publishable key" es segura para el cliente —
// el acceso real está controlado por las políticas de Row Level Security
// de la tabla saved_typologies (cada usuario solo ve/edita sus propias filas).
window.FuturaAuth = (() => {
  const SUPABASE_URL = "https://eapjmqjnnonbdggzxptz.supabase.co";
  const SUPABASE_KEY = "sb_publishable__W-g8JlTGPILKHRs61zWkA_FSkjB6Ho";
  const SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

  let client = null;
  let sdkPromise = null;

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) return Promise.resolve();
    if (sdkPromise) return sdkPromise;
    sdkPromise = new Promise((resolve, reject) => {
      // Sin esto, una red lenta/bloqueada deja la promesa colgada para
      // siempre (el navegador no siempre dispara onerror rápido) y toda la
      // UI que depende de ella (botones, modales) nunca reacciona.
      const timeout = setTimeout(() => reject(new Error("Tardó demasiado en cargar Supabase.")), 8000);
      const script = document.createElement("script");
      script.src = SDK_URL;
      script.async = true;
      script.onload = () => {
        clearTimeout(timeout);
        resolve();
      };
      script.onerror = () => {
        clearTimeout(timeout);
        reject(new Error("No se pudo cargar Supabase."));
      };
      document.head.appendChild(script);
    }).catch((err) => {
      // Deja reintentar en el próximo llamado en vez de quedar rota para
      // siempre (ej. el usuario recupera la conexión y vuelve a intentar).
      sdkPromise = null;
      throw err;
    });
    return sdkPromise;
  }

  function getClient() {
    return loadSdk().then(() => {
      if (!client) client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
      return client;
    });
  }

  function getSession() {
    return getClient()
      .then((c) => c.auth.getSession())
      .then(({ data }) => data.session);
  }

  function getUser() {
    return getClient()
      .then((c) => c.auth.getUser())
      .then(({ data }) => data.user);
  }

  function onAuthChange(callback) {
    getClient().then((c) => {
      c.auth.onAuthStateChange((_event, session) => callback(session));
    });
  }

  function signUp(email, password) {
    return getClient().then((c) => c.auth.signUp({ email, password }));
  }

  function signIn(email, password) {
    return getClient().then((c) => c.auth.signInWithPassword({ email, password }));
  }

  function signOut() {
    return getClient().then((c) => c.auth.signOut());
  }

  // Guarda (o reactiva) una tipología para el usuario logueado.
  function saveTypology(projectId, typologyId) {
    return getClient().then(async (c) => {
      const user = await getUser();
      if (!user) throw new Error("not authenticated");
      return c
        .from("saved_typologies")
        .upsert(
          { user_id: user.id, project_id: projectId, typology_id: typologyId },
          { onConflict: "user_id,project_id,typology_id", ignoreDuplicates: true }
        );
    });
  }

  function removeTypology(projectId, typologyId) {
    return getClient().then(async (c) => {
      const user = await getUser();
      if (!user) throw new Error("not authenticated");
      return c
        .from("saved_typologies")
        .delete()
        .eq("user_id", user.id)
        .eq("project_id", projectId)
        .eq("typology_id", typologyId);
    });
  }

  function removeById(id) {
    return getClient().then((c) => c.from("saved_typologies").delete().eq("id", id));
  }

  function listSaved() {
    return getClient().then(async (c) => {
      const user = await getUser();
      if (!user) return [];
      const { data, error } = await c
        .from("saved_typologies")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    });
  }

  return {
    getClient,
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
