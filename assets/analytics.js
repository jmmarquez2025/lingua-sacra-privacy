/*
 * Lingua Sacra — marketing-site analytics (PostHog).
 *
 * Reads config from the including <script> tag's data attributes:
 *   <script src="/assets/analytics.js"
 *           data-posthog-key="phc_..."
 *           data-posthog-host="https://us.i.posthog.com"
 *           defer></script>
 *
 * No-op (no network calls) if data-posthog-key is empty or on localhost,
 * so the same snippet works across dev + prod without a build step.
 */
(function () {
  var script = document.currentScript;
  if (!script) {
    var all = document.getElementsByTagName('script');
    for (var i = all.length - 1; i >= 0; i--) {
      if ((all[i].src || '').indexOf('/assets/analytics.js') !== -1) {
        script = all[i];
        break;
      }
    }
  }
  if (!script) return;
  var key = (script.getAttribute('data-posthog-key') || '').trim();
  var host = (script.getAttribute('data-posthog-host') || 'https://us.i.posthog.com').trim();
  if (!key) return;
  var h = location.hostname;
  if (h === 'localhost' || h === '127.0.0.1' || h === '') return;

  // Minimal PostHog loader — tracks pageviews + outbound clicks. Full
  // posthog-js is ~50kb gzipped; this inline version is ~1kb and covers
  // what a static marketing site actually needs.
  var distinctId = localStorage.getItem('ls_ph_id');
  if (!distinctId) {
    distinctId = 'anon_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try { localStorage.setItem('ls_ph_id', distinctId); } catch (e) {}
  }

  function send(event, props) {
    try {
      fetch(host.replace(/\/$/, '') + '/capture/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        body: JSON.stringify({
          api_key: key,
          event: event,
          distinct_id: distinctId,
          properties: Object.assign(
            {
              $current_url: location.href,
              $pathname: location.pathname,
              $host: location.hostname,
              $referrer: document.referrer || '',
              $lib: 'lingua-sacra-marketing',
            },
            props || {},
          ),
          timestamp: new Date().toISOString(),
        }),
      }).catch(function () {});
    } catch (e) {}
  }

  send('$pageview');

  // Outbound clicks — useful for measuring App Store / Play Store conversions.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!href || href.charAt(0) === '#') return;
    var isOutbound = /^https?:\/\//.test(href) && a.host !== location.host;
    if (isOutbound) {
      send('outbound_click', { href: href, text: (a.textContent || '').trim().slice(0, 80) });
    }
  }, { capture: true, passive: true });
})();
