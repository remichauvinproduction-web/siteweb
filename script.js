/**
 * RÉMI CHAUVIN — Portfolio 2026
 * Main JavaScript — Interactions, animations, accessibility
 */

'use strict';

/* ── NAV: scroll state & mobile menu ─────────────────────────── */
(function initNav() {
  const nav = document.querySelector('.nav');
  const hamburger = document.querySelector('.nav__hamburger');
  const mobileMenu = document.querySelector('.nav__mobile');
  if (!nav) return;

  // Scrolled state
  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 20);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Mobile menu toggle
  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', () => {
      const expanded = hamburger.getAttribute('aria-expanded') === 'true';
      hamburger.setAttribute('aria-expanded', String(!expanded));
      mobileMenu.classList.toggle('open', !expanded);
      document.body.style.overflow = expanded ? '' : 'hidden';
    });

    // Close on link click
    mobileMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
      });
    });

    // Close on Escape
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
        hamburger.setAttribute('aria-expanded', 'false');
        mobileMenu.classList.remove('open');
        document.body.style.overflow = '';
        hamburger.focus();
      }
    });
  }
})();

/* ── SCROLL REVEAL ───────────────────────────────────────────── */
(function initReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(el => el.classList.add('visible'));
    return;
  }
  const observer = new IntersectionObserver(
    entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }),
    { rootMargin: '0px 0px -60px 0px', threshold: 0.08 }
  );
  els.forEach(el => observer.observe(el));
})();

/* ── BACK TO TOP ─────────────────────────────────────────────── */
(function initBackToTop() {
  const btn = document.querySelector('.back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', () => {
    btn.classList.toggle('visible', window.scrollY > 500);
  }, { passive: true });
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ── GALLERY FILTERS ─────────────────────────────────────────── */
/* Réutilisable : appelée au chargement normal, et re-appelée après
   l'injection dynamique de la galerie depuis gallery.json (voir
   gallery-loader.js et l'événement 'gallery:loaded' plus bas). */
function initGalleryFilters() {
  const filterBtns = document.querySelectorAll('.gallery-filter');
  const galleryItems = document.querySelectorAll('.gallery-item');
  if (!filterBtns.length) return;

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-pressed', 'true');
      const filter = btn.dataset.filter;
      galleryItems.forEach(item => {
        const show = filter === 'all' || item.dataset.cat === filter;
        item.classList.toggle('hidden', !show);
      });
    });
  });
}
initGalleryFilters();

/* ── PHOTO LIGHTBOX ──────────────────────────────────────────── */
function initPhotoLightbox() {
  const lightbox = document.querySelector('.photo-lightbox');
  if (!lightbox) return;
  const img = lightbox.querySelector('.photo-lightbox__img');
  const closeBtn = lightbox.querySelector('.photo-lightbox__close');
  const prevBtn = lightbox.querySelector('.lightbox-prev');
  const nextBtn = lightbox.querySelector('.lightbox-next');

  let currentIdx = 0;

  const openLightbox = (idx) => {
    const visibleItems = Array.from(document.querySelectorAll('.gallery-item:not(.hidden)'));
    currentIdx = idx;
    const item = visibleItems[idx];
    if (!item) return;
    img.src = item.querySelector('img').src;
    img.alt = item.querySelector('img').alt;
    lightbox.classList.add('active');
    document.body.style.overflow = 'hidden';
    lightbox.focus();
  };

  const closeLightbox = () => {
    lightbox.classList.remove('active');
    document.body.style.overflow = '';
    img.src = '';
  };

  const navigate = (dir) => {
    const visibleItems = Array.from(document.querySelectorAll('.gallery-item:not(.hidden)'));
    currentIdx = (currentIdx + dir + visibleItems.length) % visibleItems.length;
    const item = visibleItems[currentIdx];
    img.src = item.querySelector('img').src;
    img.alt = item.querySelector('img').alt;
  };

  document.querySelectorAll('.gallery-item').forEach((item, i) => {
    item.addEventListener('click', () => {
      const visibleItems = Array.from(document.querySelectorAll('.gallery-item:not(.hidden)'));
      const visibleIdx = visibleItems.indexOf(item);
      openLightbox(visibleIdx);
    });
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', 'Ouvrir l\'image en grand');
    item.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        item.click();
      }
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeLightbox);
  if (prevBtn) prevBtn.addEventListener('click', () => navigate(-1));
  if (nextBtn) nextBtn.addEventListener('click', () => navigate(1));

  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('active')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') navigate(-1);
    if (e.key === 'ArrowRight') navigate(1);
  });
}
initPhotoLightbox();

/* Re-initialise filtres + lightbox une fois que gallery-loader.js a
   injecté les figures depuis gallery.json (sur les pages qui ont
   [data-gallery-grid]). Sans ça, les clics sur les nouvelles photos
   générées dynamiquement ne feraient rien. */
document.addEventListener('gallery:loaded', () => {
  initGalleryFilters();
  initPhotoLightbox();
});

/* ── VIDEO LIGHTBOX ──────────────────────────────────────────── */
(function initVideoLightbox() {
  const lightbox = document.querySelector('.video-lightbox');
  if (!lightbox) return;
  const iframe = lightbox.querySelector('iframe');
  const closeBtn = lightbox.querySelector('.video-lightbox__close');

  document.querySelectorAll('.video-card').forEach(card => {
    card.addEventListener('click', () => {
      const videoId = card.dataset.videoId;
      if (!videoId) return;
      iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    });
    card.setAttribute('role', 'button');
    card.setAttribute('tabindex', '0');
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); card.click(); }
    });
  });

  const closeVideo = () => {
    lightbox.classList.remove('active');
    iframe.src = '';
    document.body.style.overflow = '';
  };

  if (closeBtn) closeBtn.addEventListener('click', closeVideo);
  lightbox.addEventListener('click', e => { if (e.target === lightbox) closeVideo(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && lightbox.classList.contains('active')) closeVideo();
  });
})();

/* ── FAQ ACCORDION ───────────────────────────────────────────── */
(function initFAQ() {
  const questions = document.querySelectorAll('.faq-question');
  if (!questions.length) return;

  questions.forEach(question => {
    question.addEventListener('click', () => {
      const expanded = question.getAttribute('aria-expanded') === 'true';
      const answer = document.getElementById(question.getAttribute('aria-controls'));

      // Close all others
      questions.forEach(q => {
        q.setAttribute('aria-expanded', 'false');
        q.closest('.faq-item').classList.remove('open');
        const a = document.getElementById(q.getAttribute('aria-controls'));
        if (a) a.classList.remove('open');
      });

      // Open this one if it was closed
      if (!expanded && answer) {
        question.setAttribute('aria-expanded', 'true');
        question.closest('.faq-item').classList.add('open');
        answer.classList.add('open');
      }
    });
  });
})();

/* ── CONTACT FORM ────────────────────────────────────────────── */
(function initContactForm() {
  const form = document.querySelector('.contact-form form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('.form-submit');
    const success = form.querySelector('.form-success');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';

    try {
      const data = new FormData(form);
      const response = await fetch(form.action, {
        method: 'POST',
        body: data,
        headers: { 'Accept': 'application/json' }
      });
      if (response.ok) {
        form.reset();
        if (success) {
          success.style.display = 'block';
          success.textContent = '✓ Votre message a bien été envoyé. Je vous réponds sous 24h.';
        }
        btn.textContent = 'Envoyé !';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = originalText;
          if (success) success.style.display = 'none';
        }, 5000);
      } else {
        throw new Error('Erreur réseau');
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = originalText;
      alert('Une erreur est survenue. Contactez-moi directement par email.');
    }
  });
})();

/* ── LAZY LOADING (additional for non-native browsers) ────────── */
(function initLazyLoad() {
  if ('loading' in HTMLImageElement.prototype) return;
  const imgs = document.querySelectorAll('img[loading="lazy"]');
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const img = e.target;
        img.src = img.dataset.src || img.src;
        observer.unobserve(img);
      }
    });
  });
  imgs.forEach(img => observer.observe(img));
})();

/* ── SMOOTH ANCHOR SCROLLING ─────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const id = a.getAttribute('href').slice(1);
    const target = document.getElementById(id);
    if (!target) return;
    e.preventDefault();
    const offset = 80;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});
