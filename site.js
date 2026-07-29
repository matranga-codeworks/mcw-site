/* Frank Matranga / Matranga Codeworks — progressive enhancement only.
   Every page reads and works with this file blocked. */
(function () {
  'use strict';

  /* --- Scroll reveal -----------------------------------------------------
     Staggers the direct children of each section's inner wrapper as it comes
     into view. Hero sections opt out with data-no-reveal; they animate on load
     instead, via the .rise classes in the stylesheet. */
  function reveal() {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var wraps = document.querySelectorAll('section:not([data-no-reveal]) > .wrap');
    if (!wraps.length) return;

    var io = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        Array.prototype.forEach.call(entry.target.children, function (child, i) {
          child.style.transitionDelay = (i * 0.07) + 's';
          child.classList.add('is-in');
        });
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

    Array.prototype.forEach.call(wraps, function (wrap) {
      Array.prototype.forEach.call(wrap.children, function (child) {
        child.classList.add('reveal');
      });
      io.observe(wrap);
    });
  }

  /* --- Image slots -------------------------------------------------------
     The design used placeholder slots rather than real files. Until an image
     is dropped into images/, drop the <img> and let the hatched frame with its
     data-placeholder label show through. */
  function slots() {
    var imgs = document.querySelectorAll('img[data-slot]');
    Array.prototype.forEach.call(imgs, function (img) {
      function empty() {
        var frame = img.parentNode;
        if (frame) frame.classList.add(frame.classList.contains('photo') ? 'photo--empty' : 'slot--empty');
        img.remove();
      }
      if (img.complete && img.naturalWidth === 0) empty();
      else img.addEventListener('error', empty);
    });
  }

  /* --- Self-updating dateline -------------------------------------------
     The copyright year and the "taking clients for Qn YYYY" status used to be
     hard-coded, which is how a site starts looking abandoned. Both are now
     computed. The markup still ships a correct literal value, so with JS
     blocked the page reads fine — it just stops advancing. */
  function dateline() {
    var now = new Date();

    var years = document.querySelectorAll('[data-year]');
    Array.prototype.forEach.call(years, function (el) {
      el.textContent = now.getFullYear();
    });

    var quarters = document.querySelectorAll('[data-quarter]');
    if (!quarters.length) return;

    var year = now.getFullYear();
    var q = Math.floor(now.getMonth() / 3);           /* 0-3 */

    /* Roll to the next quarter once the current one is nearly over — "booking
       for Q3" three days before Q3 ends reads worse than saying nothing. */
    var endOfQuarter = new Date(year, q * 3 + 3, 1);
    if ((endOfQuarter - now) / 86400000 < 21) {
      q += 1;
      if (q > 3) { q = 0; year += 1; }
    }

    var text = 'Q' + (q + 1) + ' ' + year;
    Array.prototype.forEach.call(quarters, function (el) {
      el.textContent = text;
    });
  }

  function init() { reveal(); slots(); dateline(); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
