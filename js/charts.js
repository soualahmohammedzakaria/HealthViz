(function () {
  if (!window.App) throw new Error('App state not initialized');

  // Performance: Track which charts are visible
  const visibleCharts = new Set();
  let chartObserver = null;

  // Map chart container IDs to module names
  const chartIdToModule = {
    'chart-test-results': 'testResults',
    'chart-conditions': 'conditions',
    'chart-billing': 'billing',
    'chart-demographics': 'demographics',
    'chart-sankey': 'patientFlow',
    'chart-insurance-cost': 'insuranceCost',
    'chart-blood-revenue': 'bloodRevenue'
  };

  function safeInit(moduleName, rootId) {
    const mod = window.App.chartModules?.[moduleName];
    const el = document.getElementById(rootId);
    if (!mod || !el) return;
    try {
      mod.init(el);
      // Start observing for lazy updates
      if (chartObserver) {
        chartObserver.observe(el);
      }
      visibleCharts.add(rootId); // Initially assume visible
    } catch (e) {
      console.error(`Error initializing chart ${moduleName}:`, e);
    }
  }

  function safeUpdate(moduleName, rows) {
    const mod = window.App.chartModules?.[moduleName];
    if (!mod) return;
    // Guard against null/undefined rows - pass empty array instead
    const safeRows = rows || [];
    try {
      mod.update(safeRows);
    } catch (e) {
      console.error(`Error updating chart ${moduleName}:`, e);
    }
  }

  function debounce(fn, delay) {
    let timeoutId;
    return function(...args) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  // Performance: Only update visible charts
  function updateAllCharts(rows) {
    requestAnimationFrame(() => {
      // Update all charts (visible first)
      for (const chartId of visibleCharts) {
        const moduleName = chartIdToModule[chartId];
        if (moduleName) {
          safeUpdate(moduleName, rows);
        }
      }
      
      // Update non-visible charts with lower priority (after a delay)
      setTimeout(() => {
        for (const [chartId, moduleName] of Object.entries(chartIdToModule)) {
          if (!visibleCharts.has(chartId)) {
            safeUpdate(moduleName, rows);
          }
        }
      }, 100);
    });
  }

  window.App.charts = {
    init() {
      // Initialize intersection observer for lazy loading
      try {
        chartObserver = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            const chartId = entry.target.id;
            if (entry.isIntersecting) {
              visibleCharts.add(chartId);
              // Update chart immediately when it becomes visible
              const rows = window.App.state.filtered;
              if (rows && rows.length) {
                const moduleName = chartIdToModule[chartId];
                if (moduleName) {
                  requestAnimationFrame(() => safeUpdate(moduleName, rows));
                }
              }
            } else {
              visibleCharts.delete(chartId);
            }
          });
        }, { rootMargin: '100px', threshold: 0.1 });
      } catch (e) {
        console.warn('IntersectionObserver not supported, all charts will update together');
      }

      // Chart modules are plain globals loaded via script tags.
      safeInit('testResults', 'chart-test-results');
      safeInit('conditions', 'chart-conditions');
      safeInit('billing', 'chart-billing');
      safeInit('demographics', 'chart-demographics');
      safeInit('patientFlow', 'chart-sankey');
      safeInit('insuranceCost', 'chart-insurance-cost');
      safeInit('bloodRevenue', 'chart-blood-revenue');

      window.App.events.on('data:filtered', ({ rows }) => {
        updateAllCharts(rows);
      });

      const debouncedResize = debounce(() => {
        const rows = window.App.state.filtered;
        updateAllCharts(rows);
      }, 250);

      window.addEventListener('resize', debouncedResize);

      window.App.events.on('selection:reset', () => {
        const rows = window.App.state.filtered;
        updateAllCharts(rows);
      });
    }
  };
})();
