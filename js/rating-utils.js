// Helper compartido para mostrar calificaciones por estrellas (1-5, con
// decimales) a partir de una lista de reviews. Usado por desarrolladoras.js
// (listado) y desarrolladora.js (landing individual) — window.FuturaReviews
// entrega las filas crudas, este helper solo calcula el promedio y arma el
// HTML de las estrellas.
window.FuturaRating = (() => {
  const STARS = "★★★★★";

  function average(reviews) {
    const count = reviews.length;
    if (!count) return { avg: 0, count: 0 };
    const sum = reviews.reduce((total, r) => total + r.rating, 0);
    return { avg: sum / count, count };
  }

  // Dos capas de las mismas 5 estrellas: una gris de fondo y una dorada
  // encima recortada con overflow:hidden a un % de ancho — así un
  // promedio como 4.3 rellena el 86% de la 5ta estrella sin usar imágenes.
  function starsDisplayHTML(avg, opts) {
    const options = opts || {};
    const pct = Math.max(0, Math.min(5, avg)) / 5 * 100;
    const sizeClass = options.size ? " star-rating--" + options.size : "";
    return (
      '<span class="star-rating' + sizeClass + '" aria-label="' + avg.toFixed(1) + ' de 5 estrellas">' +
      '<span class="star-rating-track" aria-hidden="true">' + STARS + "</span>" +
      '<span class="star-rating-fill" aria-hidden="true" style="width:' + pct + '%">' + STARS + "</span>" +
      "</span>"
    );
  }

  return { average, starsDisplayHTML };
})();
