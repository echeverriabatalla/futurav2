// Persistencia de amenidades por proyecto (mockup). El array `amenities` en
// projects-data.js es el valor de fábrica; lo que el equipo edita desde
// admin.html se guarda como un override completo por proyecto en
// localStorage — mismo patrón que js/featured-mock.js. Cuando exista un
// backend/CMS real, este es el único lugar que hay que cambiar.
window.FuturaAmenities = (() => {
  const OVERRIDES_KEY = "futuraAmenitiesOverrides";

  function readOverrides() {
    try {
      const raw = localStorage.getItem(OVERRIDES_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeOverrides(overrides) {
    try {
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
    } catch (e) {
      /* localStorage puede fallar (ej. modo privado); el editor igual refleja el cambio en esta sesión */
    }
  }

  function list(project) {
    const overrides = readOverrides();
    if (Object.prototype.hasOwnProperty.call(overrides, project.id)) {
      return overrides[project.id];
    }
    return project.amenities || [];
  }

  // Reemplaza la lista completa de amenidades de un proyecto — el editor de
  // admin.html arma el array entero (agregar/editar/quitar) y llama save()
  // una vez con el resultado final, en vez de mutaciones incrementales.
  function save(projectId, amenities) {
    const overrides = readOverrides();
    overrides[projectId] = amenities;
    writeOverrides(overrides);
  }

  return { list, save };
})();
