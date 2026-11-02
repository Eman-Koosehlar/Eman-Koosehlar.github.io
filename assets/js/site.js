/* Shared behaviour: mobile nav toggle + config-driven external links. */
(function () {
  'use strict';

  // --- Mobile navigation -------------------------------------------------
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.querySelector('.site-header .nav');
  if (toggle && nav) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      toggle.textContent = open ? '✕' : '☰';
    });
    nav.addEventListener('click', function (e) {
      if (e.target.closest('a')) {
        nav.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.textContent = '☰';
      }
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) toggle.click();
    });
  }

  // --- Config-driven links ----------------------------------------------
  // Elements with data-link="github|linkedin|scholar|email" are filled from
  // SITE_CONFIG; if the value is empty the element (or its wrapper) is hidden.
  var cfg = window.SITE_CONFIG || {};
  document.querySelectorAll('[data-link]').forEach(function (el) {
    var key = el.getAttribute('data-link');
    var val = (cfg[key] || '').trim();
    if (!val) { el.hidden = true; return; }
    el.hidden = false; el.removeAttribute('hidden');
    el.setAttribute('href', key === 'email' ? 'mailto:' + val : val);
    if (key !== 'email') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  // Hide containers whose every link is hidden (e.g. empty contact list)
  document.querySelectorAll('[data-hide-if-empty]').forEach(function (box) {
    var anyVisible = Array.prototype.some.call(box.querySelectorAll('[data-link]'), function (a) { return !a.hidden; });
    if (!anyVisible) box.hidden = true;
  });
})();
