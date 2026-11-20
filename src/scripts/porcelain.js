/* PORCELAIN INK · motion layer
 * Editorial ink: headings settle like drying ink, section rules draw across, figures count
 * up, photographs develop from grey, buttons fill with vermilion ink and each section gets
 * a margin numeral. Adds .pi-* classes and aria-hidden decorative nodes only. */
(function () {
  'use strict';
  var doc = document, root = doc.documentElement;
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function el(tag, cls, parent) { var n = doc.createElement(tag); n.className = cls; n.setAttribute('aria-hidden', 'true'); (parent || doc.body).appendChild(n); return n; }
  function all(sel, ctx) { return Array.prototype.slice.call((ctx || doc).querySelectorAll(sel)); }
  var outside = function (n) { return !n.closest('header.hw-header, .hw-header, nav, footer, .elementor-location-header, [aria-hidden="true"]'); };

  /* Pages that render inside shadow DOM get the theme sheet too. */
  var shadowRoots = [];
  all('*').forEach(function (host) {
    var sr = host.shadowRoot;
    if (!sr) return;
    shadowRoots.push(sr);
    if (sr.querySelector('link[data-pi]')) return;
    var l = doc.createElement('link'); l.rel = 'stylesheet'; l.href = '/styles/porcelain.css'; l.setAttribute('data-pi', '');
    sr.appendChild(l);
  });
  function deep(sel) { return shadowRoots.reduce(function (list, sr) { return list.concat(all(sel, sr)); }, all(sel)); }

  /* ---------- ink-fill buttons ------------------------------------------------------------------- */
  deep('a.cta, .hwh-cta, .hw-btn--cta, .hwf-cta, .hwh-work-cta, .elementor-button, .hs-button').forEach(function (b) {
    if (b.querySelector(':scope > .pi-fill')) return;
    b.classList.add('pi-fill-host');
    b.insertBefore(el('span', 'pi-fill', b), b.firstChild);
  });

  /* ---------- margin numerals ---------------------------------------------------------------------- */
  var sections = all('section').filter(function (s) { return s.offsetHeight > 260 && outside(s) && !(s.parentElement && s.parentElement.closest('section')); });
  sections.forEach(function (s, i) {
    if (getComputedStyle(s).position === 'static') s.style.position = 'relative';
    var n = el('span', 'pi-num', s);
    var h = s.querySelector('h2, .hwh-trust-label, .hwh-partners-label');
    n.innerHTML = '<b>' + String(i + 1).padStart(2, '0') + '</b>';
    if (h) n.appendChild(doc.createTextNode(h.textContent.replace(/\s+/g, ' ').trim().slice(0, 36)));
  });

  /* ---------- cards ---------------------------------------------------------------------------------- */
  var cards = all('.hwh-bx, .hwh-ccard, .hwh-mcard, .hwh-suite-card, .hwh-award, .hwh-eng-card, .hwh-belief, ' +
                  '.elementor-widget-call-to-action .elementor-cta, .e-loop-item, .elementor-post, .hwh-res a').filter(outside);
  cards.forEach(function (c) { c.classList.add('pi-card'); });

  if (reduced || !('IntersectionObserver' in window)) return;

  /* ---------- count-up figures (text is restored exactly) --------------------------------------- */
  var NUM = /^(\d{1,4}(?:\.\d)?)([%+x]?)$/;
  var figures = all('span, strong, b, div, p').filter(function (n) {
    return !n.children.length && NUM.test(n.textContent.trim()) && outside(n) && !n.closest('.hwh-hero, .hwh-trust');
  });
  function countUp(n) {
    var raw = n.textContent.trim(), m = raw.match(NUM), end = parseFloat(m[1]), dec = (m[1].split('.')[1] || '').length, t0 = performance.now(), dur = 1400;
    function step(t) {
      var p = Math.min(1, (t - t0) / dur), v = end * (1 - Math.pow(1 - p, 3));
      n.textContent = (p < 1 ? v.toFixed(dec) : m[1]) + m[2];
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  var heads = all('h2, .hwh-leader-h, .elementor-widget-heading .elementor-heading-title').filter(function (h) { return outside(h) && !h.closest('.hwh-hero'); });
  var media = all('.hwh-ccard-media, .hwh-res a, .elementor-widget-image .elementor-widget-container').filter(outside);
  heads.forEach(function (h) { h.classList.add('pi-ink'); });
  media.forEach(function (m) { m.classList.add('pi-dev'); });
  sections.slice(1).forEach(function (s) { s.classList.add('pi-line'); });
  cards.forEach(function (c) {
    if (c.closest('.hwh-trust-marquee')) return;
    var idx = c.parentElement ? Array.prototype.indexOf.call(c.parentElement.children, c) : 0;
    c.classList.add('pi-rv'); c.style.setProperty('--d', (Math.min(idx, 6) * .07).toFixed(2) + 's');
  });
  root.classList.add('pi-js');

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      var t = en.target; io.unobserve(t);
      if (figures.indexOf(t) > -1) { countUp(t); return; }
      t.classList.add('pi-in');
      setTimeout(function () { t.style.removeProperty('--d'); }, 2000);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 });
  heads.concat(media, cards, sections.slice(1), figures).forEach(function (n) { io.observe(n); });
})();
