/* ── VIDEO LOADER (depuis videos.json, géré via /admin) ──── */
(function loadVideosFromJSON() {
  const grid = document.querySelector('[data-video-grid]');
  if (!grid) return;

  const maxItems = parseInt(grid.dataset.videoGrid, 10) || Infinity;

  fetch('/videos.json?v=' + Date.now())
    .then(res => res.json())
    .then(data => {
      const items = (data.items || []).slice(0, maxItems);
      if (!items.length) return;

      grid.innerHTML = items.map((item, i) => {
        const hasVideo = item.youtube_id && item.youtube_id.trim() !== '';
        const delayClass = i % 2 === 1 ? 'reveal-delay-1' : '';
        return `
          <article class="video-card reveal ${delayClass}"
                   ${hasVideo ? `data-video-id="${item.youtube_id}"` : ''}
                   aria-label="Vidéo : ${item.title}">
            <div class="video-card__thumb">
              <img src="${item.thumbnail}" alt="${item.title}" loading="lazy" decoding="async" width="1280" height="720">
              <div class="video-card__overlay" aria-hidden="true">
                ${hasVideo ? `
                <div class="video-play-btn" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><polygon points="4,2 14,8 4,14"/></svg>
                </div>` : `
                <div class="video-play-btn" style="opacity:0.4;cursor:default" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><polygon points="4,2 14,8 4,14"/></svg>
                </div>`}
              </div>
            </div>
            <div class="video-card__meta">
              <div class="video-card__tag">${item.tag}</div>
              <div class="video-card__title">${item.title}</div>
              <div class="video-card__desc">${item.description}</div>
              ${!hasVideo ? '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.5rem;font-style:italic">Vidéo bientôt disponible</div>' : ''}
            </div>
          </article>
        `;
      }).join('');

      /* Rendre les cartes visibles immédiatement */
      grid.querySelectorAll('.video-card').forEach(el => {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
      });

      document.dispatchEvent(new CustomEvent('videos:loaded'));
    })
    .catch(err => console.error('Erreur chargement vidéos :', err));
})();
