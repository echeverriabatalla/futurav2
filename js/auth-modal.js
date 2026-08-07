// Modal de login / crear cuenta, inyectado en el DOM bajo demanda.
// Uso: FuturaAuthModal.open(session => { ... continuar el flujo ... })
window.FuturaAuthModal = (() => {
  let overlay = null;
  let onSuccess = null;
  let mode = "login";

  function ensureModal() {
    if (overlay) return;

    overlay = document.createElement("div");
    overlay.className = "compare-overlay";
    overlay.id = "auth-overlay";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="compare-modal auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">' +
      '<header class="compare-modal-header">' +
      '<h3 id="auth-title">Iniciar sesión</h3>' +
      '<button type="button" class="agent-close" id="auth-close" aria-label="Cerrar">&times;</button>' +
      "</header>" +
      '<div class="auth-modal-body">' +
      '<p class="auth-modal-lead" id="auth-lead">Iniciá sesión para guardar tipologías en tu cuenta.</p>' +
      '<form id="auth-form">' +
      '<label class="auth-field">Correo<input type="email" id="auth-email" required autocomplete="email" /></label>' +
      '<label class="auth-field">Contraseña<input type="password" id="auth-password" required autocomplete="current-password" minlength="6" /></label>' +
      '<p class="auth-error" id="auth-error" hidden></p>' +
      '<p class="auth-info" id="auth-info" hidden></p>' +
      '<button type="submit" class="btn btn-primary" id="auth-submit">Iniciar sesión</button>' +
      "</form>" +
      '<p class="auth-switch">' +
      '<span id="auth-switch-text">¿No tenés cuenta?</span> ' +
      '<button type="button" id="auth-switch-btn">Creá una</button>' +
      "</p>" +
      "</div>" +
      "</div>";
    document.body.appendChild(overlay);

    document.getElementById("auth-close").addEventListener("click", close);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !overlay.hidden) close();
    });
    document.getElementById("auth-switch-btn").addEventListener("click", () => {
      setMode(mode === "login" ? "signup" : "login");
    });
    document.getElementById("auth-form").addEventListener("submit", handleSubmit);
  }

  function setMode(next) {
    mode = next;
    const title = document.getElementById("auth-title");
    const lead = document.getElementById("auth-lead");
    const submit = document.getElementById("auth-submit");
    const switchText = document.getElementById("auth-switch-text");
    const switchBtn = document.getElementById("auth-switch-btn");
    hideMessages();

    if (mode === "login") {
      title.textContent = "Iniciar sesión";
      lead.textContent = "Iniciá sesión para guardar tipologías en tu cuenta.";
      submit.textContent = "Iniciar sesión";
      switchText.textContent = "¿No tenés cuenta?";
      switchBtn.textContent = "Creá una";
    } else {
      title.textContent = "Crear cuenta";
      lead.textContent = "Creá tu cuenta para guardar y comparar tipologías cuando quieras.";
      submit.textContent = "Crear cuenta";
      switchText.textContent = "¿Ya tenés cuenta?";
      switchBtn.textContent = "Iniciá sesión";
    }
  }

  function hideMessages() {
    document.getElementById("auth-error").hidden = true;
    document.getElementById("auth-info").hidden = true;
  }

  function showError(msg) {
    const el = document.getElementById("auth-error");
    el.textContent = msg;
    el.hidden = false;
  }

  function showInfo(msg) {
    const el = document.getElementById("auth-info");
    el.textContent = msg;
    el.hidden = false;
  }

  function handleSubmit(e) {
    e.preventDefault();
    hideMessages();
    const email = document.getElementById("auth-email").value.trim();
    const password = document.getElementById("auth-password").value;
    const submit = document.getElementById("auth-submit");
    submit.disabled = true;
    submit.textContent = "Un momento...";

    const action = mode === "login" ? window.FuturaAuth.signIn(email, password) : window.FuturaAuth.signUp(email, password);

    action
      .then(({ data, error }) => {
        if (error) {
          showError(traducirError(error.message));
          return;
        }
        if (data && data.session) {
          const cb = onSuccess;
          close();
          if (cb) cb(data.session);
        } else if (mode === "signup") {
          showInfo("¡Listo! Revisá tu correo para confirmar la cuenta y después iniciá sesión.");
          setMode("login");
        }
      })
      .catch((err) => showError(traducirError(err.message)))
      .finally(() => {
        submit.disabled = false;
        submit.textContent = mode === "login" ? "Iniciar sesión" : "Crear cuenta";
      });
  }

  function traducirError(msg) {
    if (!msg) return "Ocurrió un error. Intentá de nuevo.";
    if (msg.includes("Invalid login credentials")) return "Correo o contraseña incorrectos.";
    if (msg.includes("already registered") || msg.includes("already exists")) return "Ese correo ya tiene una cuenta. Iniciá sesión.";
    if (msg.includes("Password should be")) return "La contraseña debe tener al menos 6 caracteres.";
    return msg;
  }

  function open(callback, initialMode) {
    ensureModal();
    onSuccess = callback;
    setMode(initialMode || "login");
    document.getElementById("auth-form").reset();
    overlay.hidden = false;
    document.getElementById("auth-email").focus();
  }

  function close() {
    if (overlay) overlay.hidden = true;
  }

  return { open, close };
})();
