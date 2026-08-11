// Reviews y calificación por estrellas — implementación REAL (Supabase).
// Requiere que la página use js/supabase-client.js como FuturaAuth (no el
// mock) y la tabla `reviews` — ver
// supabase/migrations/20260811224257_create_reviews.sql.
//
// Para pasar una página del mock (js/reviews-mock.js) a esta implementación
// real: cambiá el <script src="js/reviews-mock.js"> por
// <script src="js/reviews-supabase.js"> (y asegurate de que esa misma
// página ya esté usando js/supabase-client.js en vez de js/mock-auth.js —
// las reviews reales necesitan un user_id real de auth.users).
window.FuturaReviews = (() => {
  function listForDeveloper(developerSlug) {
    return window.FuturaAuth.getClient().then((client) =>
      client
        .from("reviews")
        .select("id, user_id, user_name, rating, comentario, fecha")
        .eq("developer_id", developerSlug)
        .order("fecha", { ascending: false })
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        })
    );
  }

  function getMyReview(developerSlug) {
    return Promise.all([window.FuturaAuth.getClient(), window.FuturaAuth.getUser()]).then(([client, user]) => {
      if (!user) return null;
      return client
        .from("reviews")
        .select("id, rating, comentario, fecha")
        .eq("developer_id", developerSlug)
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        });
    });
  }

  // upsert con onConflict sobre (developer_id, user_id) — la misma llamada
  // sirve para "crear mi review" y "editar mi review", y la unique
  // constraint de la tabla lo hace cumplir también del lado del servidor,
  // no solo confiando en que el cliente pida primero getMyReview().
  function upsertReview(developerSlug, rating, comentario) {
    return Promise.all([window.FuturaAuth.getClient(), window.FuturaAuth.getUser()]).then(([client, user]) => {
      if (!user) throw new Error("not authenticated");
      return client
        .from("reviews")
        .upsert(
          {
            developer_id: developerSlug,
            user_id: user.id,
            user_name: user.email,
            rating: rating,
            comentario: comentario || "",
            fecha: new Date().toISOString(),
          },
          { onConflict: "developer_id,user_id" }
        )
        .select()
        .single()
        .then(({ data, error }) => {
          if (error) throw error;
          return data;
        });
    });
  }

  return { listForDeveloper, getMyReview, upsertReview };
})();
