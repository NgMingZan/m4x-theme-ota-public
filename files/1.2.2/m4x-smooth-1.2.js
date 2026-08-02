/* M4X 1.2 Smooth OTA */
(() => {
  'use strict';
  const d = document;
  let scrollTimer = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lowMemory = Number(navigator.deviceMemory || 4) <= 3;
  if (reduced || lowMemory) d.body.classList.add('m4x-low-power');

  addEventListener('scroll', () => {
    d.body.classList.add('m4x-scrolling');
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => d.body.classList.remove('m4x-scrolling'), 120);
  }, { passive: true });

  d.addEventListener('DOMContentLoaded', () => {
    d.querySelectorAll('img').forEach((img, i) => {
      if (!img.hasAttribute('decoding')) img.decoding = 'async';
      if (i > 2 && !img.hasAttribute('loading')) img.loading = 'lazy';
      img.fetchPriority = i < 2 ? 'high' : 'low';
    });
  }, { once: true });

  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 250));
  idle(() => {
    try {
      const stale = Object.keys(localStorage).filter(k => /^m4x_temp_|^m4x_cache_old_/.test(k));
      stale.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  });
})();
