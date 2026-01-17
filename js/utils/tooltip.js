(function () {
  if (!window.App) throw new Error('App state not initialized');

  const el = document.getElementById('tooltip');

  function show(html, x, y) {
    if (!el) return;
    el.innerHTML = html;
    el.style.opacity = '1';
    el.setAttribute('aria-hidden', 'false');
    move(x, y);
  }

  function move(x, y) {
    if (!el) return;
    const pad = 12;
    const maxX = window.innerWidth - pad;
    const maxY = window.innerHeight - pad;

    const tx = Math.min(x + 14, maxX);
    const ty = Math.min(y + 14, maxY);
    el.style.transform = `translate(${tx}px, ${ty}px)`;
  }

  function hide() {
    if (!el) return;
    el.style.opacity = '0';
    el.setAttribute('aria-hidden', 'true');
    el.style.transform = 'translate(-999px, -999px)';
  }

  window.App.utils = window.App.utils || {};
  window.App.utils.tooltip = { show, move, hide };
})();
