// Small shared state + event hub.
// I keep it as a global to avoid bundlers and keep things simple.

(function () {
  const listeners = new Map();

  function on(eventName, handler) {
    if (!listeners.has(eventName)) listeners.set(eventName, new Set());
    listeners.get(eventName).add(handler);
    return () => listeners.get(eventName)?.delete(handler);
  }

  function emit(eventName, payload) {
    const set = listeners.get(eventName);
    if (!set) return;
    for (const handler of set) handler(payload);
  }

  // Compute base path for GitHub Pages compatibility
  // This handles both root deployment and subdirectory deployment (e.g., /HealthViz/)
  function getBasePath() {
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const src = scripts[i].src;
      if (src && src.includes('state.js')) {
        // Extract base path from script src (remove /js/state.js)
        return src.replace(/js\/state\.js.*$/, '');
      }
    }
    // Fallback: use current page location
    const path = window.location.pathname;
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash > 0) {
      return window.location.origin + path.substring(0, lastSlash + 1);
    }
    return window.location.origin + '/';
  }

  const basePath = getBasePath();

  window.App = {
    version: '0.1',
    config: {
      basePath: basePath,
      dataPath: basePath + 'data/healthcare_dataset.csv',
      palette: {
        Normal: '#2a6f97',
        Abnormal: '#b23a48',
        Inconclusive: '#6b7280'
      }
    },
    state: {
      raw: [],
      filtered: [],
      selectedHospital: null,
      filters: {
        ageGroup: 'all',
        gender: 'all',
        admissionType: 'all',
        condition: 'all',
        testResult: 'all',
        bloodType: 'all',
        insurance: 'all',
        lengthOfStayMax: null,
        billingRange: null,
        admissionDateFrom: null,
        admissionDateTo: null
      }
    },
    events: { on, emit }
  };
})();
