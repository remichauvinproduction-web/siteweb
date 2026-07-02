/* ── GALLERY LOADER (depuis gallery.json, géré via /admin) ──── */
(function loadGalleryFromJSON() {
  const grid = document.querySelector('[data-gallery-grid]');
  if (!grid) return;

  const maxItems = parseInt(grid.dataset.galleryGrid, 10) || Infinity;

  fetch('/gallery.json', { cache: 'no-store' })
    .then(res => res.json())
    .then(data => {
      const items = (data.items || []).slice(0, maxItems);
      grid.innerHTML = items.map((item, i) => `
        <figure class="gallery-item reveal" data-cat="${item.category}" role="listitem">
          <img class="gallery-item__img" src="${item.image}" alt="${item.alt || ''}" loading="${i < 4 ? 'eager' : 'lazy'}" decoding="async" width="600" height="600">
          <div class="gallery-item__overlay" aria-hidden="true"><span class="gallery-item__label">${item.label || ''}</span></div>
        </figure>
      `).join('');

      document.dispatchEvent(new CustomEvent('gallery:loaded'));
    })
    .catch(err => console.error('Erreur de chargement de la galerie :', err));
})();
