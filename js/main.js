// Entry point. I’m keeping this file pretty small so it’s easier to debug.

(function () {
  if (!window.App) throw new Error('App state not initialized');

  function parseDateInput(value) {
    if (!value) return null;
    const parts = String(value).split('-').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
    const [y, m, d] = parts;
    return new Date(y, m - 1, d);
  }

  function wireUI() {
    const confirmBtn = document.getElementById('btn-confirm');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => {
        window.App.data?.applyFilters();
      });
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        window.App.state.selectedHospital = null;
        window.App.state.filters.ageGroup = 'all';
        window.App.state.filters.gender = 'all';
        window.App.state.filters.admissionType = 'all';
        window.App.state.filters.condition = 'all';
        window.App.state.filters.testResult = 'all';
        window.App.state.filters.bloodType = 'all';
        window.App.state.filters.insurance = 'all';
        window.App.state.filters.lengthOfStayMax = null;
        window.App.state.filters.billingRange = null;
        window.App.state.filters.admissionDateFrom = null;
        window.App.state.filters.admissionDateTo = null;

        // Reset UI elements too.
        const ids = ['filter-age', 'filter-gender', 'filter-admission', 'filter-condition', 'filter-test-result', 'filter-blood-type', 'filter-insurance'];
        for (const id of ids) {
          const el = document.getElementById(id);
          if (el) el.value = 'all';
        }

        const dateFrom = document.getElementById('filter-date-from');
        const dateTo = document.getElementById('filter-date-to');
        const lenMax = document.getElementById('filter-len-max');
        if (dateFrom) dateFrom.value = '';
        if (dateTo) dateTo.value = '';
        if (lenMax) lenMax.value = '';

        window.App.events.emit('selection:reset');
        window.App.data?.applyFilters();
      });
    }

    const ageSel = document.getElementById('filter-age');
    const genderSel = document.getElementById('filter-gender');
    const admissionSel = document.getElementById('filter-admission');
    const conditionSel = document.getElementById('filter-condition');
    const testResultSel = document.getElementById('filter-test-result');
    const bloodTypeSel = document.getElementById('filter-blood-type');
    const insuranceSel = document.getElementById('filter-insurance');
    const dateFromEl = document.getElementById('filter-date-from');
    const dateToEl = document.getElementById('filter-date-to');
    const lenMaxEl = document.getElementById('filter-len-max');

    if (ageSel) {
      ageSel.addEventListener('change', () => {
        window.App.state.filters.ageGroup = ageSel.value;
      });
    }

    if (genderSel) {
      genderSel.addEventListener('change', () => {
        window.App.state.filters.gender = genderSel.value;
      });
    }

    if (admissionSel) {
      admissionSel.addEventListener('change', () => {
        window.App.state.filters.admissionType = admissionSel.value;
      });
    }

    if (conditionSel) {
      conditionSel.addEventListener('change', () => {
        window.App.state.filters.condition = conditionSel.value;
      });
    }

    if (testResultSel) {
      testResultSel.addEventListener('change', () => {
        window.App.state.filters.testResult = testResultSel.value;
      });
    }

    if (bloodTypeSel) {
      bloodTypeSel.addEventListener('change', () => {
        window.App.state.filters.bloodType = bloodTypeSel.value;
      });
    }

    if (insuranceSel) {
      insuranceSel.addEventListener('change', () => {
        window.App.state.filters.insurance = insuranceSel.value;
      });
    }

    if (dateFromEl) {
      dateFromEl.addEventListener('change', () => {
        window.App.state.filters.admissionDateFrom = parseDateInput(dateFromEl.value);
      });
    }

    if (dateToEl) {
      dateToEl.addEventListener('change', () => {
        window.App.state.filters.admissionDateTo = parseDateInput(dateToEl.value);
      });
    }

    if (lenMaxEl) {
      lenMaxEl.addEventListener('change', () => {
        const val = lenMaxEl.value;
        window.App.state.filters.lengthOfStayMax = val ? Number(val) : null;
      });
    }
  }

  async function boot() {
    wireUI();

    window.App.map?.init();
    window.App.charts?.init?.();

    try {
      await window.App.data.load();
    } catch (err) {
      // Log detailed error info for debugging
      console.error('Data load failed:', err);
      console.error('Attempted to load from:', window.App.config.dataPath);
      
      const hint = document.getElementById('analysis-notes');
      if (hint) {
        const p = document.createElement('p');
        p.style.color = '#b23a48';
        p.textContent = `Failed to load CSV from "${window.App.config.dataPath}". ` +
          'If running locally, use a local server (Live Server). ' +
          'If on GitHub Pages, ensure the data file is committed and the path is correct.';
        hint.prepend(p);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
