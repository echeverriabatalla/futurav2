// Ilustraciones referenciales de tipología (planta e isométrico), generadas
// en SVG a partir de sus specs. Compartido entre proyecto.html y
// mi-cuenta/comparar.html — todavía no hay renders/planos reales.
window.FuturaTypologyVisuals = (() => {
  // Los lotes (propertyType "lote") no tienen habitaciones ni baños — se
  // reconocen por eso en vez de por un campo aparte.
  function isLot(t) {
    return !t.bedrooms && !t.bathrooms;
  }

  // Specs a mostrar como pills junto a cada tipología. Un solo lugar para
  // esta lista evita repetir el caso especial de lote en cada página que
  // muestra tipologías (proyecto, guardadas, etc.).
  function specList(t) {
    if (isLot(t)) return [t.sqm + " m²", "Lote de terreno"];
    return [t.sqm + " m²", t.bedrooms + " hab.", t.bathrooms + " baños"];
  }

  function floorPlanSVG(t) {
    if (isLot(t)) return lotPlanSVG(t);

    const w = 320,
      h = 210;
    const livingH = 82;
    const bottomH = h - livingH;
    const bedroomCount = Math.max(1, Math.round(t.bedrooms));
    const bathCount = Math.max(1, Math.ceil(t.bathrooms));
    const cols = bedroomCount + bathCount;
    const colW = w / cols;

    let cells = "";
    for (let i = 0; i < bedroomCount; i++) {
      const x = i * colW;
      cells +=
        '<rect x="' + x + '" y="' + livingH + '" width="' + colW + '" height="' + bottomH +
        '" fill="none" stroke="#c6cfe3" stroke-width="1.5"/>' +
        '<text x="' + (x + colW / 2) + '" y="' + (livingH + bottomH / 2) +
        '" text-anchor="middle" font-size="10" fill="#5b6b8c" font-family="Inter, sans-serif">Hab.</text>';
    }
    for (let i = 0; i < bathCount; i++) {
      const x = (bedroomCount + i) * colW;
      cells +=
        '<rect x="' + x + '" y="' + livingH + '" width="' + colW + '" height="' + bottomH +
        '" fill="#eef1f8" stroke="#c6cfe3" stroke-width="1.5"/>' +
        '<text x="' + (x + colW / 2) + '" y="' + (livingH + bottomH / 2) +
        '" text-anchor="middle" font-size="9.5" fill="#5b6b8c" font-family="Inter, sans-serif">Baño</text>';
    }

    return (
      '<svg viewBox="0 0 ' + w + " " + h + '" role="img" aria-label="Planta arquitectónica referencial">' +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="#ffffff"/>' +
      '<rect x="0" y="0" width="' + w + '" height="' + livingH + '" fill="none" stroke="#0b1220" stroke-width="2"/>' +
      '<text x="14" y="' + livingH / 2 + '" font-size="12" fill="#0b1220" font-weight="700" font-family="Inter, sans-serif">Sala / Cocina</text>' +
      cells +
      '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="none" stroke="#0b1220" stroke-width="2"/>' +
      "</svg>"
    );
  }

  function lotPlanSVG(t) {
    return (
      '<svg viewBox="0 0 320 210" role="img" aria-label="Lote referencial">' +
      '<rect x="0" y="0" width="320" height="210" fill="#ffffff"/>' +
      '<rect x="24" y="24" width="272" height="162" fill="#eef1f8" stroke="#0b1220" stroke-width="2" stroke-dasharray="7 5"/>' +
      '<circle cx="24" cy="24" r="4.5" fill="#c9a15a"/><circle cx="296" cy="24" r="4.5" fill="#c9a15a"/>' +
      '<circle cx="24" cy="186" r="4.5" fill="#c9a15a"/><circle cx="296" cy="186" r="4.5" fill="#c9a15a"/>' +
      '<text x="160" y="100" text-anchor="middle" font-size="14" fill="#0b1220" font-weight="700" font-family="Inter, sans-serif">Lote de terreno</text>' +
      '<text x="160" y="122" text-anchor="middle" font-size="12" fill="#5b6b8c" font-family="Inter, sans-serif">' + t.sqm + " m²</text>" +
      "</svg>"
    );
  }

  function isoSVG(t) {
    if (isLot(t)) return lotIsoSVG(t);

    const height = 40 + Math.min(60, t.sqm / 4);
    const topY = 90 - height;
    return (
      '<svg viewBox="0 0 320 210" role="img" aria-label="Vista isométrica referencial">' +
      '<polygon points="160,' + (topY - 30) + " 260," + (topY + 20) + " 160," + (topY + 70) + " 60," + (topY + 20) +
      '" fill="#d8b878" stroke="#0b1220" stroke-width="2"/>' +
      '<polygon points="60,' + (topY + 20) + " 160," + (topY + 70) + " 160," + 150 + " 60," + 100 +
      '" fill="#16233f" stroke="#0b1220" stroke-width="2"/>' +
      '<polygon points="260,' + (topY + 20) + " 160," + (topY + 70) + " 160," + 150 + " 260," + 100 +
      '" fill="#1f3358" stroke="#0b1220" stroke-width="2"/>' +
      '<rect x="90" y="' + (topY + 55) + '" width="18" height="18" fill="#c9a15a" opacity="0.9"/>' +
      '<rect x="120" y="' + (topY + 65) + '" width="18" height="18" fill="#c9a15a" opacity="0.9"/>' +
      '<rect x="182" y="' + (topY + 65) + '" width="18" height="18" fill="#c9a15a" opacity="0.9"/>' +
      '<rect x="212" y="' + (topY + 55) + '" width="18" height="18" fill="#c9a15a" opacity="0.9"/>' +
      "</svg>"
    );
  }

  function lotIsoSVG(t) {
    return (
      '<svg viewBox="0 0 320 210" role="img" aria-label="Vista isométrica de lote referencial">' +
      '<polygon points="160,40 270,102 160,164 50,102" fill="#d8e0f2" stroke="#0b1220" stroke-width="2"/>' +
      '<polygon points="160,40 270,102 160,164 50,102" fill="none" stroke="#c9a15a" stroke-width="2" stroke-dasharray="6 5"/>' +
      '<text x="160" y="107" text-anchor="middle" font-size="13" fill="#0b1220" font-weight="700" font-family="Inter, sans-serif">' + t.sqm + " m²</text>" +
      "</svg>"
    );
  }

  return { floorPlanSVG, isoSVG, specList, isLot };
})();
