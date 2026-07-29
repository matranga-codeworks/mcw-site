/* Frank Matranga / Matranga Codeworks — analytics.
   PostHog, configured for a brochure site: no cookies, no session recording,
   no autocapture. Just pageviews (with referrer + UTM, which is how you see
   where bookings come from) and the handful of CTA clicks that actually mean
   something.

   SETUP — nothing is sent until you fill in PROJECT_KEY below:
     1. posthog.com → create a project for matrangacode.works
     2. Project settings → paste the "Project API Key" (starts with `phc_`)
     3. If your project is in the EU cloud, change HOST to
        'https://eu.i.posthog.com'
   With the key left as-is this file does nothing at all — no network request,
   no console noise — so the site is safe to ship before you sign up. */
(function () {
  'use strict';

  var PROJECT_KEY = 'phc_KfyRfyLWUF3NeEBejcibkLjnzFHoYrWLOPHK8zsnkxo';
  var HOST = 'https://us.i.posthog.com';

  /* Bail out silently until a real key is in place. */
  if (!PROJECT_KEY || PROJECT_KEY.indexOf('phc_') !== 0 || PROJECT_KEY === 'phc_REPLACE_ME') return;

  /* Respect Do Not Track. */
  if (navigator.doNotTrack === '1' || window.doNotTrack === '1') return;

  var assetHost = HOST.replace('.i.posthog.com', '-assets.i.posthog.com');

  var s = document.createElement('script');
  s.src = assetHost + '/static/array.js';
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.onload = function () {
    if (!window.posthog || !window.posthog.init) return;

    window.posthog.init(PROJECT_KEY, {
      api_host: HOST,
      /* localStorage rather than cookies — keeps a visitor's journey across
         pages without putting the site in cookie-banner territory. */
      persistence: 'localStorage',
      person_profiles: 'identified_only',
      autocapture: false,
      disable_session_recording: true,
      capture_pageview: true,
      capture_pageleave: true
    });

    bindCtas();
  };
  document.head.appendChild(s);

  /* --- CTA goals ---------------------------------------------------------
     Anything carrying data-cta reports a `cta_click`. The page and the
     section it sits in ride along as properties, so "which booking button
     actually gets used" is a breakdown rather than four separate events. */
  function bindCtas() {
    document.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-cta]') : null;
      if (!el) return;

      var section = el.closest('section');
      window.posthog.capture('cta_click', {
        cta: el.getAttribute('data-cta'),
        page: location.pathname,
        section: (section && section.id) || null,
        label: (el.textContent || '').trim().slice(0, 80)
      });
    }, true);
  }
})();
