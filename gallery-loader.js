/* ── GALLERY LOADER (depuis gallery.json, géré via /admin) ──── */
(function loadGalleryFromJSON() {
  const grid = document.querySelector('[data-gallery-grid]');
  if (!grid) return;

  const maxItems = parseInt(grid.dataset.galleryGrid, 10) || Infinity;

  fetch('/gallery.json?v=' + Date.now())
    .then(res => res.json())
    .then(data => {
      const items = (data.items || []).slice(0, maxItems);
      if (!items.length) {
        grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:2rem">Aucune photo pour le moment.</p>';
        return;
      }

      grid.innerHTML = items.map((item, i) => `
        <figure class="gallery-item" data-cat="${item.category || 'all'}" role="listitem">
          <img class="gallery-item__img"
               src="${item.image}"
               alt="${item.alt || ''}"
               loading="${i < 4 ? 'eager' : 'lazy'}"
               decoding="async"
               width="600" height="600"
               onerror="this.closest('figure').style.display='none'">
          <div class="gallery-item__overlay" aria-hidden="true">
            <span class="gallery-item__label">${item.label || ''}</span>
          </div>
        </figure>
      `).join('');

      /* Les figures sont générées dynamiquement donc l'IntersectionObserver
         du script principal ne les a pas vues. On les rend visibles directement
         sans passer par l'animation reveal (qui les laisserait à opacity:0). */
      grid.querySelectorAll('.gallery-item').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });

      document.dispatchEvent(new CustomEvent('gallery:loaded'));
    })
    .catch(err => {
      console.error('Erreur chargement galerie :', err);
      grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:2rem">Erreur de chargement de la galerie.</p>';
    });
})();
