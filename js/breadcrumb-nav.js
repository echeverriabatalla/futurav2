// Botón "Volver" + breadcrumb, compartido por las páginas de navegación
// profunda (proyecto, desarrolladora, mi-cuenta/comparar).
//
// Cada link interno que lleva a una de estas páginas se arma con
// withOrigin(), que le agrega ?from=... (y contexto extra) a la URL. Al
// llegar, resolveOrigin() lee ese contexto:
//  - si hay ?from=..., el botón "Volver" usa el historial del navegador
//    (history.back()), porque sabemos que la página anterior es nuestra y
//    existe en el historial — esto además conserva el scroll/estado tal
//    como estaba.
//  - si no hay ?from= (el usuario llegó por link directo o compartido, o
//    recargó la página), el botón navega directo a una ruta de fallback
//    fija, ya que el historial no es confiable en ese caso.
window.FuturaBreadcrumb = (() => {
  function resolveOrigin(basePrefix) {
    const params = new URLSearchParams(window.location.search);
    const from = params.get("from");

    if (from === "resultados") {
      return { href: basePrefix + "resultados.html", label: "Resultados" };
    }
    if (from === "desarrolladoras") {
      return { href: basePrefix + "desarrolladoras.html", label: "Desarrolladoras" };
    }
    if (from === "cuenta") {
      return { href: basePrefix + "mi-cuenta/comparar.html", label: "Mis tipologías" };
    }
    if (from === "desarrolladora") {
      const search = new URLSearchParams({ dev: params.get("dev") || "" });
      return { href: basePrefix + "desarrolladora.html?" + search.toString(), label: params.get("fromLabel") || "Desarrolladora" };
    }
    if (from === "proyecto") {
      const search = new URLSearchParams({ id: params.get("pid") || "" });
      return { href: basePrefix + "proyecto.html?" + search.toString(), label: params.get("fromLabel") || "Proyecto" };
    }
    return null;
  }

  function render(opts) {
    const container = opts.container;
    const basePrefix = opts.basePrefix || "";
    const origin = resolveOrigin(basePrefix);
    const target = origin || opts.fallback;

    const wrap = document.createElement("div");
    wrap.className = "breadcrumb-nav";

    const backBtn = document.createElement("button");
    backBtn.type = "button";
    backBtn.className = "breadcrumb-back";
    backBtn.textContent = "← Volver";
    backBtn.addEventListener("click", () => {
      if (origin) {
        window.history.back();
      } else {
        window.location.href = target.href;
      }
    });

    const trail = document.createElement("nav");
    trail.className = "breadcrumb-trail";
    trail.setAttribute("aria-label", "Ruta de navegación");
    trail.innerHTML =
      '<a href="' + basePrefix + 'index.html#inicio">Inicio</a>' +
      '<span class="breadcrumb-sep">/</span>' +
      '<a href="' + target.href + '">' + target.label + "</a>" +
      '<span class="breadcrumb-sep">/</span>' +
      '<span class="breadcrumb-current">' + opts.currentLabel + "</span>";

    wrap.appendChild(backBtn);
    wrap.appendChild(trail);
    container.innerHTML = "";
    container.appendChild(wrap);
  }

  // Arma un link "hacia adelante" con el contexto de origen para que la
  // página destino sepa cómo volver. extra permite mandar datos como el
  // slug de la desarrolladora o el nombre a mostrar en el breadcrumb.
  function withOrigin(baseHref, from, extra) {
    const [path, existingQuery] = baseHref.split("?");
    const params = new URLSearchParams(existingQuery || "");
    params.set("from", from);
    if (extra) {
      Object.keys(extra).forEach((key) => {
        if (extra[key] != null) params.set(key, extra[key]);
      });
    }
    return path + "?" + params.toString();
  }

  return { render, withOrigin };
})();
