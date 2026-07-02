/* ── IMAGES FIXES (depuis site-images.json, géré via /admin) ──── */
(function loadFixedImages() {
  const targets = document.querySelectorAll('[data-img-key]');
  if (!targets.length) return;

  fetch('/site-images.json?v=' + Date.now())
    .then(res => res.json())
    .then(data => {
      targets.forEach(el => {
        const key = el.dataset.imgKey;
        const [section, field] = key.split('.');
        const value = data[section] && data[section][field];
        if (!value) return;

        const preloader = new Image();
        preloader.onload = () => {
          el.src = value;
          /* Fondu d'apparition une fois l'image chargée */
          requestAnimationFrame(() => { el.style.opacity = '1'; });
        };
        preloader.onerror = () => {
          /* En cas d'erreur, affiche quand même l'image pour ne pas bloquer */
          el.src = value;
          el.style.opacity = '1';
        };
        preloader.src = value;
      });
    })
    .catch(err => console.error('Erreur chargement images fixes :', err));
})();
