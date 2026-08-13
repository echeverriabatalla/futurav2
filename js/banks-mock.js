// Persistencia de la información de bancos (mockup). window.FUTURA_BANKS es
// el valor de fábrica; lo que el equipo edita desde admin.html se guarda
// como override por banco (keyed por nombre) en localStorage — mismo patrón
// que js/featured-mock.js y js/amenities-mock.js. No hay una API pública
// confiable de tasas/plazos en tiempo real, así que esto es lo que
// mantiene los datos actualizados mientras tanto.
window.FuturaBanks = (() => {
  const OVERRIDES_KEY = "futuraBanksOverrides";
  const DEFAULTS = window.FUTURA_BANKS || [];

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

  // Devuelve el directorio completo, con los overrides ya aplicados encima
  // de cada banco de fábrica que corresponda por nombre.
  function list() {
    const overrides = readOverrides();
    return DEFAULTS.map((bank) =>
      Object.prototype.hasOwnProperty.call(overrides, bank.name) ? Object.assign({}, bank, overrides[bank.name]) : bank
    );
  }

  function get(name) {
    return list().find((b) => b.name === name) || null;
  }

  function save(name, updates) {
    const overrides = readOverrides();
    overrides[name] = Object.assign({}, overrides[name], updates);
    writeOverrides(overrides);
  }

  return { list, get, save };
})();
