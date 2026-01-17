(function () {
  if (!window.App) throw new Error('App state not initialized');

  // Deterministic, "realistic-ish" US bounding box placement.
  // This is a compromise: the dataset does not include coordinates, but we still want stable placements.
  function hashStringToUnit(str) {
    // Not cryptographic. Just stable.
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    // Convert to [0,1)
    return (h >>> 0) / 4294967296;
  }

  function hospitalToLonLat(hospitalName) {
    const t = hashStringToUnit(hospitalName || 'Unknown');
    const t2 = hashStringToUnit((hospitalName || 'Unknown') + '::b');

    // Rough contiguous US bounds
    const lonMin = -124.7;
    const lonMax = -66.9;
    const latMin = 25.0;
    const latMax = 49.2;

    // Keep points away from edges a bit
    const lon = lonMin + (lonMax - lonMin) * (0.06 + 0.88 * t);
    const lat = latMin + (latMax - latMin) * (0.08 + 0.84 * t2);

    return { lon, lat };
  }

  window.App.utils = window.App.utils || {};
  window.App.utils.geo = { hospitalToLonLat };
})();
