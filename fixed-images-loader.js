/* ── IMAGES FIXES (depuis site-images.json, géré via /admin) ──── */
/* Toute balise <img data-img-key="accueil.hero"> (ou autre clé pointée
   en notation "section.champ") voit son src mis à jour automatiquement
   au chargement de la page, sans avoir à toucher au HTML. */
(function loadFixedImages() {
  const targets = document.querySelectorAll('[data-img-key]');
  if (!targets.length) return;

  fetch('/site-images.json', { cache: 'no-store' })
    .then(res => res.json())
    .then(data => {
      targets.forEach(el => {
        const key = el.dataset.imgKey;
        const [section, field] = key.split('.');
        const value = data[section] && data[section][field];
        if (value) el.src = value;
      });
    })
    .catch(err => console.error('Erreur de chargement des images fixes :', err));
})();
