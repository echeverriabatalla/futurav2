// Persistencia de "destacado" (mockup). El campo `destacado` en
// projects-data.js es el valor por defecto (lo que trae cada proyecto de
// fábrica); lo que el equipo cambia desde admin.html se guarda como un
// override en localStorage, mismo patrón que js/mock-auth.js y
// js/leads-mock.js — cuando exista un backend/CMS real, este es el único
// lugar que hay que cambiar (ver setFeatured()).
window.FuturaFeatured = (() => {
  const OVERRIDES_KEY = "futuraFeaturedOverrides";

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
      /* localStorage puede fallar (ej. modo privado); el toggle igual refleja el cambio en esta sesión */
    }
  }

  function isFeatured(project) {
    const overrides = readOverrides();
    if (Object.prototype.hasOwnProperty.call(overrides, project.id)) {
      return !!overrides[project.id];
    }
    return !!project.destacado;
  }

  function setFeatured(projectId, value) {
    const overrides = readOverrides();
    overrides[projectId] = !!value;
    writeOverrides(overrides);
  }

  function listFeatured(projects) {
    return projects.filter((p) => isFeatured(p));
  }

  return { isFeatured, setFeatured, listFeatured };
})();
