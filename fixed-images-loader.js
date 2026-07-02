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

        /* Précharge la nouvelle image avant de l'afficher pour éviter
           l'effet de double image / flash pendant le chargement */
        const preloader = new Image();
        preloader.onload = () => { el.src = value; };
        preloader.onerror = () => { /* garde l'image src originale */ };
        preloader.src = value;
      });
    })
    .catch(err => console.error('Erreur chargement images fixes :', err));
})();
