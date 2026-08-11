// Reviews y calificación por estrellas (mockup). Misma interfaz que
// js/reviews-supabase.js — window.FuturaReviews con listForDeveloper /
// getMyReview / upsertReview — así que pasar a la implementación real es
// solo cambiar el <script src>, mismo patrón que js/mock-auth.js y
// js/leads-mock.js. Guarda en localStorage en vez de en la tabla `reviews`
// de Supabase (ver supabase/migrations/20260811224257_create_reviews.sql
// para el esquema real).
window.FuturaReviews = (() => {
  const REVIEWS_KEY = "futuraMockReviews";
  const NETWORK_DELAY_MS = 400;

  function delay(value) {
    return new Promise((resolve) => setTimeout(() => resolve(value), NETWORK_DELAY_MS));
  }

  function readAll() {
    try {
      const raw = localStorage.getItem(REVIEWS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function writeAll(rows) {
    try {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(rows));
    } catch (e) {
      /* localStorage puede fallar (ej. modo privado); no es crítico */
    }
  }

  function listForDeveloper(developerSlug) {
    return delay(
      readAll()
        .filter((r) => r.developer_id === developerSlug)
        .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    );
  }

  function getMyReview(developerSlug) {
    return window.FuturaAuth.getUser().then((user) => {
      if (!user) return null;
      const row = readAll().find((r) => r.developer_id === developerSlug && r.user_id === user.id);
      return delay(row || null);
    });
  }

  // Mismo contrato que la versión real: si ya existe una review de este
  // usuario para esta desarrolladora, la actualiza en vez de duplicarla.
  function upsertReview(developerSlug, rating, comentario) {
    return window.FuturaAuth.getUser().then((user) => {
      if (!user) throw new Error("not authenticated");
      const rows = readAll();
      const idx = rows.findIndex((r) => r.developer_id === developerSlug && r.user_id === user.id);
      const row = {
        id: idx >= 0 ? rows[idx].id : "mock-review-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
        developer_id: developerSlug,
        user_id: user.id,
        user_name: user.email,
        rating: rating,
        comentario: comentario || "",
        fecha: new Date().toISOString(),
      };
      if (idx >= 0) rows[idx] = row;
      else rows.push(row);
      writeAll(rows);
      return delay(row);
    });
  }

  return { listForDeveloper, getMyReview, upsertReview };
})();
