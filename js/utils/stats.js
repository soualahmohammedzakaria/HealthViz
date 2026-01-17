(function () {
  if (!window.App) throw new Error('App state not initialized');

  function groupBy(values, keyFn) {
    const map = new Map();
    for (const v of values) {
      const key = keyFn(v);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(v);
    }
    return map;
  }

  function dominantCategory(values, accessor) {
    const counts = new Map();
    for (const v of values) {
      const key = accessor(v);
      if (key == null) continue;
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    let best = null;
    let bestCount = -1;
    for (const [k, c] of counts.entries()) {
      if (c > bestCount) {
        best = k;
        bestCount = c;
      }
    }
    return best;
  }

  function mean(values, accessor) {
    let sum = 0;
    let n = 0;
    for (const v of values) {
      const x = accessor(v);
      if (x == null || Number.isNaN(x)) continue;
      sum += x;
      n += 1;
    }
    return n ? sum / n : null;
  }

  window.App.utils = window.App.utils || {};
  window.App.utils.stats = { groupBy, dominantCategory, mean };
})();
