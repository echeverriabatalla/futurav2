// Íconos de línea (SVG inline, 24×24, trazo currentColor) usados como
// respaldo visual de una amenidad cuando no tiene fotos cargadas — ver
// renderAmenities() en js/proyecto.js. window.FuturaAmenityIcons.ICON_OPTIONS
// alimenta además el selector de ícono del panel de administración
// (admin.html), así ambos lugares comparten la misma lista.
window.FuturaAmenityIcons = (() => {
  const ICONS = {
    pool:
      '<path d="M3 17c1.2 1 2.4 1 3.6 0 1.2-1 2.4-1 3.6 0 1.2 1 2.4 1 3.6 0 1.2-1 2.4-1 3.6 0 1.2 1 2.4 1 3.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M3 21c1.2 1 2.4 1 3.6 0 1.2-1 2.4-1 3.6 0 1.2 1 2.4 1 3.6 0 1.2-1 2.4-1 3.6 0 1.2 1 2.4 1 3.6 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M7 13V6.5A2.5 2.5 0 0 1 9.5 4c1.2 0 2.1.7 2.4 1.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="16" cy="6" r="1.4" fill="currentColor"/>',
    gym:
      '<path d="M4 12h2M18 12h2M6 9v6M18 9v6M9 12h6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/><rect x="2" y="10" width="2.4" height="4" rx="0.6" fill="currentColor"/><rect x="19.6" y="10" width="2.4" height="4" rx="0.6" fill="currentColor"/>',
    coworking:
      '<rect x="3" y="5" width="18" height="11" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 19h18M9 16v3M15 16v3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    security:
      '<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9.5 12l1.8 1.8L15 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>',
    garden:
      '<path d="M12 21V10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M12 10c0-3.5 2.6-5.5 6-5.5 0 3.5-2.6 5.5-6 5.5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    "event-hall":
      '<rect x="3" y="4" width="18" height="14" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M3 9h18M8 4v14" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="14" cy="13.5" r="2" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    "sport-court":
      '<rect x="3" y="5" width="18" height="14" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="3.4" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M12 5v3.6M12 15.4V19M3 12h3.6M17.4 12H21" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    rooftop:
      '<path d="M3 11l9-6 9 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 10.5V20h14v-9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 20v-4h6v4" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    pet:
      '<circle cx="7" cy="8" r="1.6" fill="currentColor"/><circle cx="11.5" cy="5.5" r="1.6" fill="currentColor"/><circle cx="16" cy="8" r="1.6" fill="currentColor"/><path d="M8 15c0-2.4 1.8-4 3.8-4s3.8 1.6 3.8 4c0 2-1.6 3.4-3.8 3.4S8 17 8 15z" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    playground:
      '<path d="M6 21V9M6 9l9 4M15 13V5M4 5h11" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="18" cy="17" r="3" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    clubhouse:
      '<path d="M4 20V10l8-6 8 6v10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 20v-6h6v6" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 20h16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    trail:
      '<path d="M4 20c3-1 3.5-4 2-6-1.5-2 0-4.5 2.5-4.5S12 12 12 15c0 2.5 2 3 3.5 2s2-3 .5-4.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="6" r="2" fill="none" stroke="currentColor" stroke-width="1.5"/>',
    parking:
      '<rect x="3" y="4" width="18" height="16" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 17V7h3.4a2.8 2.8 0 1 1 0 5.6H9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    gate:
      '<path d="M4 20V6l8-3 8 3v14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M4 20h16M8 20V9M16 20V9M12 20V6" fill="none" stroke="currentColor" stroke-width="1.4"/>',
    utilities:
      '<path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>',
    water:
      '<path d="M12 3c3.5 4.2 6 7.7 6 10.8A6 6 0 0 1 6 13.8C6 10.7 8.5 7.2 12 3z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    road:
      '<path d="M9 3 5 21M15 3l4 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M12 5v2.4M12 10.8v2.4M12 16.2v2.4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    default:
      '<path d="M12 3l2.3 5.9L20.5 9l-4.9 4 1.7 6.2L12 15.8 6.7 19.2l1.7-6.2-4.9-4 6.2-.1z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>',
  };

  const ICON_OPTIONS = [
    { key: "pool", label: "Piscina" },
    { key: "gym", label: "Gimnasio" },
    { key: "coworking", label: "Coworking" },
    { key: "security", label: "Seguridad" },
    { key: "garden", label: "Áreas verdes / jardín" },
    { key: "event-hall", label: "Salón de eventos" },
    { key: "sport-court", label: "Cancha deportiva" },
    { key: "rooftop", label: "Rooftop" },
    { key: "pet", label: "Pet-friendly" },
    { key: "playground", label: "Zona de juegos" },
    { key: "clubhouse", label: "Club house" },
    { key: "trail", label: "Senderos" },
    { key: "parking", label: "Parqueo" },
    { key: "gate", label: "Acceso / portón" },
    { key: "utilities", label: "Electricidad" },
    { key: "water", label: "Agua potable" },
    { key: "road", label: "Calles" },
    { key: "default", label: "Otro" },
  ];

  function iconSVG(key) {
    const path = ICONS[key] || ICONS.default;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + path + "</svg>";
  }

  return { iconSVG, ICON_OPTIONS };
})();
