// Botón "Mi cuenta" del header de la landing: si ya hay sesión va directo
// a la página de comparación, si no abre el login/registro y continúa ahí.
(() => {
  const btn = document.getElementById("account-cta");
  if (!btn) return;

  const goToAccount = () => {
    window.location.href = "mi-cuenta/comparar.html";
  };

  btn.addEventListener("click", () => {
    window.FuturaAuth.getSession()
      .then((session) => {
        if (session) {
          goToAccount();
        } else {
          window.FuturaAuthModal.open(goToAccount);
        }
      })
      .catch(() => {
        // No se pudo confirmar la sesión: se trata igual que "no logueado".
        window.FuturaAuthModal.open(goToAccount);
      });
  });
})();
