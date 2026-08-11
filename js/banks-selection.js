// Selección de bancos disponibles marcados en proyecto.html — guardada en
// localStorage por project_id, no ligada a la cuenta (auth-agnóstica, igual
// que un carrito): así el usuario puede marcar bancos antes de iniciar
// sesión. mi-cuenta-comparar.js lee esta selección al armar el lead
// consolidado (ver window.FuturaBankSelection.get en submitLead()).
window.FuturaBankSelection = (() => {
  const KEY = "futuraBankSelection";

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeAll(map) {
    try {
      localStorage.setItem(KEY, JSON.stringify(map));
    } catch (e) {
      /* localStorage puede fallar (ej. modo privado); no es crítico */
    }
  }

  function get(projectId) {
    return readAll()[projectId] || [];
  }

  // Devuelve true/false: si el banco quedó seleccionado o no tras el toggle.
  function toggle(projectId, bank) {
    const map = readAll();
    const list = map[projectId] || [];
    const idx = list.indexOf(bank);
    let nowSelected;
    if (idx >= 0) {
      list.splice(idx, 1);
      nowSelected = false;
    } else {
      list.push(bank);
      nowSelected = true;
    }
    map[projectId] = list;
    writeAll(map);
    return nowSelected;
  }

  return { get, toggle };
})();
