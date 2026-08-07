document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("js-reveal");

  const header = document.getElementById("site-header");
  const menuToggle = document.getElementById("menu-toggle");

  const onScroll = () => {
    header.classList.toggle("is-scrolled", window.scrollY > 24);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  menuToggle.addEventListener("click", () => {
    header.classList.toggle("is-open");
  });

  header.querySelectorAll(".nav-links a").forEach((link) => {
    link.addEventListener("click", () => header.classList.remove("is-open"));
  });

  const revealItems = document.querySelectorAll(".step-card");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, index) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add("is-visible"), index * 90);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2 }
  );
  revealItems.forEach((item) => observer.observe(item));
});
