/* ==========================================================================
   RÉMI PRODUCTION — Script unique (aucune dépendance)
   1 Utilitaires · 2 Navigation · 3 Révélation au scroll · 4 Lecteur (lightbox)
   5 Portfolio vidéo · 6 Portfolio photo · 7 Bande démo · 8 Formulaire
   Les données du portfolio sont dans /data/*.json (éditables via /admin).
   ========================================================================== */
(function () {
  'use strict';
  window.__rm = 1; // signale à la page que le script est bien chargé

  /* ── 1. UTILITAIRES ─────────────────────────────────────────────────── */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const CATEGORIES = {
    publicite: 'Publicité',
    entreprise: 'Entreprise',
    reseaux: 'Réseaux sociaux',
    evenementiel: 'Événementiel',
    creation: 'Créations',
    photographie: 'Photographie'
  };
  const PHOTO_CATEGORIES = { portrait: 'Portrait', evenement: 'Événement', sport: 'Sport', nature: 'Nature' };

  const getJSON = (url) =>
    fetch(url, { cache: 'no-cache' }).then((r) => {
      if (!r.ok) throw new Error(url + ' : ' + r.status);
      return r.json();
    });

  /** Extrait l'identifiant YouTube d'une URL (watch, youtu.be, shorts, embed) ou d'un ID seul. */
  function youTubeId(input) {
    if (!input) return '';
    input = String(input).trim();
    if (/^[\w-]{11}$/.test(input)) return input;
    try {
      const u = new URL(input);
      if (u.searchParams.get('v')) return u.searchParams.get('v');
      const parts = u.pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || '';
    } catch (e) {
      return '';
    }
  }
  const isVertical = (item) => /9\s*[:/x]\s*16|vertical/i.test(item.orientation || '');
  const hasVideo = (item) => !!(youTubeId(item.youtube) || item.file);
  const thumbOf = (item) => item.thumbnail || (youTubeId(item.youtube) ? 'https://i.ytimg.com/vi/' + youTubeId(item.youtube) + '/hqdefault.jpg' : '');

  /* ── 2. NAVIGATION ──────────────────────────────────────────────────── */
  (function nav() {
    const bar = $('.nav');
    if (!bar) return;
    const burger = $('.nav__burger', bar);
    const onScroll = () => bar.classList.toggle('scrolled', window.scrollY > 24);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    if (!burger) return;
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
      bar.classList.toggle('open', open);
      document.body.style.overflow = open ? 'hidden' : '';
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    $$('.nav__panel a', bar).forEach((a) => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && bar.classList.contains('open')) { setOpen(false); burger.focus(); }
    });
    window.matchMedia('(min-width: 861px)').addEventListener('change', (m) => { if (m.matches) setOpen(false); });
  })();

  /* ── 3. RÉVÉLATION AU SCROLL ────────────────────────────────────────── */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) { en.target.classList.add('visible'); io.unobserve(en.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 })
    : null;
  function observeReveals(root) {
    $$('.reveal:not(.visible)', root || document).forEach((el) => (io ? io.observe(el) : el.classList.add('visible')));
  }
  observeReveals();

  /* ── 4. LECTEUR PLEIN ÉCRAN (vidéo 16:9 / 9:16 et photos) ───────────── */
  let box, stage, closeBtn, prevBtn, nextBtn;
  let gallery = [], galleryIndex = 0;

  function ensureBox() {
    if (box) return;
    box = document.createElement('dialog');
    box.className = 'lightbox';
    box.setAttribute('aria-label', 'Lecteur');
    box.innerHTML =
      '<button type="button" class="lightbox__btn lightbox__close" aria-label="Fermer">✕</button>' +
      '<button type="button" class="lightbox__btn lightbox__prev" aria-label="Précédent">‹</button>' +
      '<button type="button" class="lightbox__btn lightbox__next" aria-label="Suivant">›</button>' +
      '<div class="lightbox__stage"></div>';
    document.body.appendChild(box);
    stage = $('.lightbox__stage', box);
    closeBtn = $('.lightbox__close', box);
    prevBtn = $('.lightbox__prev', box);
    nextBtn = $('.lightbox__next', box);
    closeBtn.addEventListener('click', () => box.close());
    prevBtn.addEventListener('click', () => step(-1));
    nextBtn.addEventListener('click', () => step(1));
    box.addEventListener('click', (e) => { if (e.target === box || e.target === stage) box.close(); });
    box.addEventListener('close', () => { stage.innerHTML = ''; document.body.style.overflow = ''; });
    box.addEventListener('keydown', (e) => {
      if (!gallery.length) return;
      if (e.key === 'ArrowLeft') step(-1);
      if (e.key === 'ArrowRight') step(1);
    });
  }

  /** Ouvre une vidéo (YouTube sans cookies ou fichier mp4 local). Le lecteur n'est chargé qu'au clic. */
  function openVideo(item) {
    ensureBox();
    gallery = [];
    prevBtn.hidden = nextBtn.hidden = true;
    const id = youTubeId(item.youtube);
    const frame = document.createElement('div');
    frame.className = 'lightbox__frame' + (isVertical(item) ? ' is-vertical' : '');
    if (item.file) {
      frame.innerHTML = '<video controls autoplay playsinline preload="metadata" src="' + esc(item.file) + '"' + (item.thumbnail ? ' poster="' + esc(item.thumbnail) + '"' : '') + '></video>';
    } else {
      frame.innerHTML = '<iframe title="' + esc(item.title || 'Vidéo') + '" src="https://www.youtube-nocookie.com/embed/' + esc(id) +
        '?autoplay=1&rel=0&modestbranding=1&playsinline=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    }
    stage.innerHTML = '';
    stage.appendChild(frame);
    box.setAttribute('aria-label', item.title || 'Vidéo');
    document.body.style.overflow = 'hidden';
    box.showModal();
  }

  function showPhoto() {
    const p = gallery[galleryIndex];
    stage.innerHTML = '<img class="lightbox__img" src="' + esc(p.image) + '" alt="' + esc(p.alt || p.label || '') + '"><p class="lightbox__caption">' +
      esc(p.label || '') + ' · ' + (galleryIndex + 1) + '/' + gallery.length + '</p>';
  }
  function openPhoto(list, index) {
    ensureBox();
    gallery = list;
    galleryIndex = index;
    prevBtn.hidden = nextBtn.hidden = list.length < 2;
    showPhoto();
    box.setAttribute('aria-label', 'Photo agrandie');
    document.body.style.overflow = 'hidden';
    box.showModal();
  }
  function step(dir) {
    galleryIndex = (galleryIndex + dir + gallery.length) % gallery.length;
    showPhoto();
  }

  /* ── 5. PORTFOLIO VIDÉO (data/videos.json) ──────────────────────────── */
  const PLAY = '<span class="work__play" aria-hidden="true"><svg viewBox="0 0 16 16"><polygon points="3,1 15,8 3,15"/></svg></span>';

  function workCard(item, i) {
    const v = isVertical(item);
    const t = thumbOf(item);
    const media =
      '<span class="work__media">' +
      (t ? '<img src="' + esc(t) + '" alt="Vignette : ' + esc(item.title) + '" loading="lazy" decoding="async" width="' + (v ? 720 : 1280) + '" height="' + (v ? 1280 : 720) + '">' : '') +
      (hasVideo(item) ? PLAY : '') + '</span>';
    const meta =
      '<span class="work__meta">' +
      (item.type ? '<span class="work__type">' + esc(item.type) + '</span>' : '') +
      '<span class="work__title" style="display:block">' + esc(item.title) + '</span>' +
      (item.description ? '<span class="work__line" style="display:block">' + esc(item.description) + '</span>' : '') +
      (item.client ? '<span class="work__line" style="display:block"><strong>Client</strong> · ' + esc(item.client) + '</span>' : '') +
      (item.role ? '<span class="work__line" style="display:block"><strong>Mon rôle</strong> · ' + esc(item.role) + '</span>' : '') +
      (!hasVideo(item) ? '<span class="work__line" style="display:block;font-style:italic">Vidéo bientôt disponible</span>' : '') +
      '</span>';
    const cls = 'work reveal' + (v ? ' work--v' : '');
    const style = ' style="--d:' + ((i % 3) * 0.08).toFixed(2) + 's"';
    return hasVideo(item)
      ? '<button type="button" class="' + cls + '"' + style + ' data-i="' + i + '" data-cat="' + esc(item.category) + '" aria-label="Lire la vidéo : ' + esc(item.title) + '">' + media + meta + '</button>'
      : '<article class="' + cls + '"' + style + ' data-cat="' + esc(item.category) + '">' + media + meta + '</article>';
  }

  /** Une vignette qui ne charge pas (réseau, lien cassé) est masquée : le fond sombre reste, sans icône cassée. */
  function hideBroken(root) {
    $$('img', root).forEach((im) => {
      const hide = () => { im.style.visibility = 'hidden'; };
      im.addEventListener('error', hide, { once: true });
      if (im.complete && im.naturalWidth === 0) hide();
    });
  }

  function renderWorks(container, items) {
    container.innerHTML = items.map(workCard).join('');
    hideBroken(container);
    container.addEventListener('click', (e) => {
      const b = e.target.closest('button.work');
      if (b) openVideo(items[Number(b.dataset.i)]);
    });
    observeReveals(container);
  }

  /* ── 6. PORTFOLIO PHOTO (data/gallery.json) ─────────────────────────── */
  function renderPhotos(container, items) {
    container.innerHTML = items.map((p, i) =>
      '<button type="button" class="photo reveal" style="--d:' + ((i % 4) * 0.06).toFixed(2) + 's" data-i="' + i + '" data-cat="' + esc(p.category) + '" aria-label="Agrandir : ' + esc(p.label || 'photo') + '">' +
      '<img src="' + esc(p.image) + '" alt="' + esc(p.alt || p.label || '') + '" loading="lazy" decoding="async" width="800" height="1000">' +
      (p.label ? '<span class="photo__cap">' + esc(p.label) + '</span>' : '') + '</button>').join('');
    hideBroken(container);
    container.addEventListener('click', (e) => {
      const b = e.target.closest('button.photo');
      if (!b) return;
      const visible = $$('button.photo:not(.hidden)', container);
      openPhoto(visible.map((el) => items[Number(el.dataset.i)]), visible.indexOf(b));
    });
    observeReveals(container);
  }

  function chips(container, entries, current, onPick) {
    container.innerHTML = entries.map(([key, label]) =>
      '<button type="button" class="chip" data-f="' + esc(key) + '" aria-pressed="' + (key === current) + '">' + esc(label) + '</button>').join('');
    container.addEventListener('click', (e) => {
      const b = e.target.closest('.chip');
      if (!b) return;
      $$('.chip', container).forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
      onPick(b.dataset.f);
    });
  }

  /* Page d'accueil : sélection de réalisations */
  const home = $('[data-works="home"]');
  if (home) {
    getJSON('/data/videos.json').then((d) => {
      let items = (d.items || []).filter((x) => x.title);
      const featured = items.filter((x) => x.featured);
      items = (featured.length ? featured : items).slice(0, Number(home.dataset.limit) || 3);
      if (!items.length) { home.innerHTML = '<p class="empty">Les réalisations arrivent bientôt.</p>'; return; }
      renderWorks(home, items);
    }).catch(() => { home.innerHTML = '<p class="empty">Impossible de charger les réalisations. <a class="link-arrow" href="/realisations">Voir la page Réalisations</a></p>'; });
  }

  /* Page Réalisations : vidéos + photos avec filtres */
  const worksEl = $('#works'), photosEl = $('#photos');
  if (worksEl && photosEl) {
    Promise.all([
      getJSON('/data/videos.json').catch(() => ({ items: [] })),
      getJSON('/data/gallery.json').catch(() => ({ items: [] }))
    ]).then(([v, g]) => {
      const videos = (v.items || []).filter((x) => x.title);
      const photos = (g.items || []).filter((x) => x.image);
      const worksBlock = $('#works-block'), photosBlock = $('#photos-block');
      renderWorks(worksEl, videos);
      renderPhotos(photosEl, photos);

      /* Filtre principal : uniquement les catégories qui contiennent des projets */
      const present = Object.keys(CATEGORIES).filter((k) => (k === 'photographie' ? photos.length : videos.some((x) => x.category === k)));
      const entries = [['all', 'Tout']].concat(present.map((k) => [k, CATEGORIES[k]]));
      const apply = (f) => {
        const showPhotos = f === 'all' || f === 'photographie';
        const showVideos = f !== 'photographie';
        photosBlock.classList.toggle('hidden', !showPhotos || !photos.length);
        worksBlock.classList.toggle('hidden', !showVideos || !videos.length);
        $$('.work', worksEl).forEach((el) => el.classList.toggle('hidden', !(f === 'all' || el.dataset.cat === f)));
        if (history.replaceState) history.replaceState(null, '', f === 'all' ? location.pathname : '#' + f);
      };
      const start = location.hash.replace('#', '');
      const current = entries.some((e) => e[0] === start) ? start : 'all';
      if (entries.length > 2) chips($('#filters'), entries, current, apply);
      apply(current);

      /* Sous-filtres photo (portrait, événement…) */
      const pc = Object.keys(PHOTO_CATEGORIES).filter((k) => photos.some((p) => p.category === k));
      if (pc.length > 1) {
        chips($('#photo-filters'), [['all', 'Toutes']].concat(pc.map((k) => [k, PHOTO_CATEGORIES[k]])), 'all', (f) => {
          $$('.photo', photosEl).forEach((el) => el.classList.toggle('hidden', !(f === 'all' || el.dataset.cat === f)));
        });
      }
      if (!videos.length) worksBlock.classList.add('hidden');
    });
  }

  /* ── 7. BANDE DÉMO (data/showreel.json) ─────────────────────────────── */
  const reel = $('[data-showreel]');
  if (reel) {
    getJSON('/data/showreel.json').then((d) => {
      if (!(youTubeId(d.youtube) || d.file)) return; // pas de bande démo : l'emplacement reste en « bientôt »
      reel.dataset.empty = 'false';
      reel.removeAttribute('aria-disabled');
      reel.setAttribute('aria-label', 'Lancer la bande démo');
      const label = $('.showreel__label', reel);
      if (label) label.innerHTML = 'Voir la bande démo<small>' + esc(d.duree || 'Showreel') + '</small>';
      if (d.poster) {
        const im = new Image();
        im.src = d.poster; im.alt = ''; im.width = 640; im.height = 360; im.decoding = 'async';
        reel.insertBefore(im, reel.firstChild);
      }
      reel.addEventListener('click', () => openVideo({ title: d.title || 'Bande démo', youtube: d.youtube, file: d.file, orientation: '16:9' }));
    }).catch(() => {});
  }

  /* ── 8. FORMULAIRE DE CONTACT ───────────────────────────────────────── */
  const form = $('#contact-form');
  if (form) {
    const status = $('#form-status');
    const mail = form.dataset.mail;
    const show = (state, html) => { status.hidden = false; status.dataset.state = state; status.innerHTML = html; status.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
    if (/[?&]envoye=1/.test(location.search)) show('ok', '<strong>Message envoyé.</strong> Merci, je reviens vers vous rapidement.');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      if ($('[name="_honey"]', form).value) return; // anti-spam
      const btn = $('button[type="submit"]', form);
      const label = btn.textContent;
      btn.disabled = true; btn.textContent = 'Envoi en cours…';
      status.hidden = true;
      try {
        const res = await fetch(form.dataset.endpoint, { method: 'POST', headers: { Accept: 'application/json' }, body: new FormData(form) });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || String(data.success) === 'false') throw new Error('envoi refusé');
        form.reset();
        show('ok', '<strong>Message envoyé.</strong> Merci, je lis votre demande et je reviens vers vous rapidement avec un devis personnalisé.');
      } catch (err) {
        show('error', '<strong>L’envoi a échoué.</strong> Vous pouvez réessayer, ou m’écrire directement à <a href="mailto:' + esc(mail) + '">' + esc(mail) + '</a>.');
      } finally {
        btn.disabled = false; btn.textContent = label;
      }
    });
  }
})();
