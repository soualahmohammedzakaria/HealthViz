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

  window.App = {
    version: '0.1',
    config: {
      dataPath: 'data/healthcare_dataset.csv',
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
