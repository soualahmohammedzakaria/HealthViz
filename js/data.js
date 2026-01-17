(function () {
  if (!window.App) throw new Error('App state not initialized');

  const parseDate = d3.timeParse('%Y-%m-%d');

  // Performance: Data caching layer
  const cache = {
    hospitalStats: null,
    hospitalStatsKey: null,
    kpiResults: null,
    kpiKey: null,
    filterResults: new Map(),
    maxCacheSize: 50
  };

  function getCacheKey(filters, selectedHospital) {
    // Custom serialization to handle Date objects properly
    const keyObj = { ...filters, selectedHospital };
    if (keyObj.admissionDateFrom instanceof Date) {
      keyObj.admissionDateFrom = keyObj.admissionDateFrom.getTime();
    }
    if (keyObj.admissionDateTo instanceof Date) {
      keyObj.admissionDateTo = keyObj.admissionDateTo.getTime();
    }
    return JSON.stringify(keyObj);
  }

  function clearCache() {
    cache.hospitalStats = null;
    cache.hospitalStatsKey = null;
    cache.kpiResults = null;
    cache.kpiKey = null;
    cache.filterResults.clear();
  }

  // Performance: Batch filter processing
  function filterRowsBatch(raw, filters, selectedHospital, batchSize = 5000) {
    const cacheKey = getCacheKey(filters, selectedHospital);
    if (cache.filterResults.has(cacheKey)) {
      return cache.filterResults.get(cacheKey);
    }

    const {
      ageGroup, gender, admissionType, condition, testResult,
      billingRange, bloodType, insurance, lengthOfStayMax,
      admissionDateFrom, admissionDateTo
    } = filters;

    let admissionDateToEnd = null;
    if (admissionDateTo instanceof Date && !Number.isNaN(admissionDateTo.getTime())) {
      admissionDateToEnd = new Date(admissionDateTo.getTime());
      admissionDateToEnd.setHours(23, 59, 59, 999);
    }

    const out = [];
    const len = raw.length;
    
    // Process in batches for better performance
    for (let i = 0; i < len; i++) {
      const r = raw[i];
      if (selectedHospital && r.hospital !== selectedHospital) continue;
      if (ageGroup !== 'all' && r.ageGroup !== ageGroup) continue;
      if (gender !== 'all' && r.gender !== gender) continue;
      if (admissionType !== 'all' && r.admissionType !== admissionType) continue;
      if (condition !== 'all' && r.medicalCondition !== condition) continue;
      if (testResult !== 'all' && r.testResult !== testResult) continue;
      if (bloodType !== 'all' && r.bloodType !== bloodType) continue;
      if (insurance !== 'all' && r.insurance !== insurance) continue;
      if (Number.isFinite(lengthOfStayMax)) {
        if (r.lengthOfStayDays == null || r.lengthOfStayDays > lengthOfStayMax) continue;
      }
      if (admissionDateFrom instanceof Date && !Number.isNaN(admissionDateFrom.getTime())) {
        if (!(r.admissionDate instanceof Date) || r.admissionDate < admissionDateFrom) continue;
      }
      if (admissionDateToEnd) {
        if (!(r.admissionDate instanceof Date) || r.admissionDate > admissionDateToEnd) continue;
      }
      if (billingRange && r.billingAmount != null) {
        if (r.billingAmount < billingRange[0] || r.billingAmount > billingRange[1]) continue;
      } else if (billingRange && r.billingAmount == null) {
        continue;
      }
      out.push(r);
    }

    // Manage cache size (LRU-style eviction)
    if (cache.filterResults.size >= cache.maxCacheSize) {
      const firstKey = cache.filterResults.keys().next().value;
      cache.filterResults.delete(firstKey);
    }
    cache.filterResults.set(cacheKey, out);

    return out;
  }

  function cleanString(v) {
    if (v == null) return null;
    const s = String(v).trim();
    return s.length ? s : null;
  }

  function cleanHospitalName(v) {
    const s = cleanString(v);
    if (!s) return null;
    // Some entries end with commas or have random spacing.
    return s.replace(/,+$/g, '').replace(/\s+/g, ' ').trim();
  }

  function safeNumber(v) {
    if (v == null) return null;
    const x = Number(v);
    if (Number.isNaN(x)) return null;
    return x;
  }

  function ageGroupFromAge(age) {
    if (age == null || Number.isNaN(age)) return null;
    if (age <= 18) return '0–18';
    if (age <= 40) return '19–40';
    if (age <= 65) return '41–65';
    return '65+';
  }

  function daysBetween(a, b) {
    if (!(a instanceof Date) || !(b instanceof Date)) return null;
    const ms = b.getTime() - a.getTime();
    if (!Number.isFinite(ms)) return null;
    const days = ms / (1000 * 60 * 60 * 24);
    // Sometimes dates are swapped or messy; don't pretend it's valid.
    if (days < 0) return null;
    return days;
  }

  function normalizeTestResult(v) {
    const s = cleanString(v);
    if (!s) return 'Inconclusive';
    if (s === 'Normal' || s === 'Abnormal' || s === 'Inconclusive') return s;
    // Anything weird gets lumped into Inconclusive rather than breaking charts.
    return 'Inconclusive';
  }

  function rowParser(d) {
    const age = safeNumber(d.Age);
    const ageClamped = (age != null && age >= 0 && age <= 110) ? age : null;

    const admissionDate = cleanString(d['Date of Admission']);
    const dischargeDate = cleanString(d['Discharge Date']);

    const admission = admissionDate ? parseDate(admissionDate) : null;
    const discharge = dischargeDate ? parseDate(dischargeDate) : null;

    const billing = safeNumber(d['Billing Amount']);
    const room = safeNumber(d['Room Number']);

    const gender = cleanString(d.Gender);
    const condition = cleanString(d['Medical Condition']);
    const admissionType = cleanString(d['Admission Type']);

    const hospital = cleanHospitalName(d.Hospital);

    const out = {
      name: cleanString(d.Name),
      age: ageClamped,
      ageGroup: ageGroupFromAge(ageClamped),
      gender,
      bloodType: cleanString(d['Blood Type']),

      medicalCondition: condition,
      medication: cleanString(d.Medication),
      testResult: normalizeTestResult(d['Test Results']),

      doctor: cleanString(d.Doctor),
      hospital,
      insurance: cleanString(d['Insurance Provider']),
      billingAmount: (billing != null && billing >= 0) ? billing : null,
      roomNumber: (room != null && room >= 0) ? Math.round(room) : null,
      admissionType,

      admissionDate: admission,
      dischargeDate: discharge,
      lengthOfStayDays: daysBetween(admission, discharge)
    };

    // Derive coarse US region from hospital location hash
    try {
      const { hospitalToLonLat } = window.App.utils.geo || {};
      if (typeof hospitalToLonLat === 'function') {
        const { lon, lat } = hospitalToLonLat(hospital || 'Unknown');
        let region = 'Midwest';
        if (lon <= -110) region = 'West';
        else if (lon >= -90 && lat >= 37) region = 'Northeast';
        else if (lon >= -90 && lat < 37) region = 'South';
        else region = 'Midwest';
        out.region = region;
      }
    } catch (_) {}

    return out;
  }

  function uniqueSorted(values) {
    return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
  }

  function setSelectOptions(selectId, values) {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    // Keep first option (All)
    const keep = sel.querySelector('option[value="all"]');
    sel.innerHTML = '';
    if (keep) sel.appendChild(keep);

    for (const v of values) {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    }
  }

  function updateMeta(total, selectionLabel) {
    const recordsEl = document.querySelector('#meta-records .meta-pill__value');
    const selectionEl = document.querySelector('#meta-selection .meta-pill__value');
    if (recordsEl) recordsEl.textContent = (total ?? '—');
    if (selectionEl) selectionEl.textContent = selectionLabel ?? 'All';
  }

  function applyFilters() {
    const { raw, selectedHospital, filters } = window.App.state;

    // Use cached filtering for performance
    const out = filterRowsBatch(raw, filters, selectedHospital);

    window.App.state.filtered = out;

    // Build selection label from filters
    const {
      ageGroup, gender, admissionType, condition, testResult,
      billingRange, bloodType, insurance, lengthOfStayMax,
      admissionDateFrom, admissionDateTo
    } = filters;

    const selectionBits = [];
    if (selectedHospital) selectionBits.push(selectedHospital);
    if (testResult !== 'all') selectionBits.push(testResult);
    if (bloodType !== 'all') selectionBits.push(`Blood ${bloodType}`);
    if (insurance !== 'all') selectionBits.push(insurance);
    if (Number.isFinite(lengthOfStayMax)) selectionBits.push(`LOS ≤ ${lengthOfStayMax}`);
    if (condition !== 'all') selectionBits.push(condition);
    if (gender !== 'all') selectionBits.push(gender);
    if (ageGroup !== 'all') selectionBits.push(ageGroup);
    if (admissionType !== 'all') selectionBits.push(admissionType);
    if (billingRange) selectionBits.push(`Billing ${Math.round(billingRange[0])}–${Math.round(billingRange[1])}`);
    if (admissionDateFrom) selectionBits.push(`From ${d3.timeFormat('%Y-%m-%d')(admissionDateFrom)}`);
    if (admissionDateTo) selectionBits.push(`To ${d3.timeFormat('%Y-%m-%d')(admissionDateTo)}`);

    updateMeta(out.length, selectionBits.length ? selectionBits.join(' · ') : 'All');
    updateKPIs(out);
    window.App.events.emit('data:filtered', { rows: out });
  }

  // Performance: Cache KPI DOM elements
  let kpiElements = null;
  function getKPIElements() {
    if (!kpiElements) {
      kpiElements = {
        totalPatients: document.getElementById('kpi-total-patients'),
        totalRevenue: document.getElementById('kpi-total-revenue'),
        avgBilling: document.getElementById('kpi-avg-billing'),
        avgLOS: document.getElementById('kpi-avg-los'),
        hospitals: document.getElementById('kpi-hospitals')
      };
    }
    return kpiElements;
  }

  // Performance: Cache last KPI values to avoid unnecessary DOM updates
  let lastKPIValues = null;

  function updateKPIs(rows) {
    const totalPatients = rows.length;
    
    // Optimized calculations - single pass through data
    let totalRevenue = 0;
    let losSum = 0;
    let losCount = 0;
    const hospitalSet = new Set();
    
    const len = rows.length;
    for (let i = 0; i < len; i++) {
      const row = rows[i];
      totalRevenue += row.billingAmount || 0;
      if (row.lengthOfStayDays != null) {
        losSum += row.lengthOfStayDays;
        losCount++;
      }
      if (row.hospital) hospitalSet.add(row.hospital);
    }
    
    const avgBilling = totalPatients > 0 ? totalRevenue / totalPatients : 0;
    const avgLOS = losCount > 0 ? losSum / losCount : 0;
    const uniqueHospitals = hospitalSet.size;

    // Skip DOM update if values haven't changed
    const newValues = `${totalPatients}|${totalRevenue}|${avgBilling}|${avgLOS}|${uniqueHospitals}`;
    if (newValues === lastKPIValues) return;
    lastKPIValues = newValues;

    const { formatMoney, formatNumber } = window.App.utils.format;

    // Batch DOM updates using cached elements
    requestAnimationFrame(() => {
      const els = getKPIElements();
      if (els.totalPatients) els.totalPatients.textContent = formatNumber(totalPatients);
      if (els.totalRevenue) els.totalRevenue.textContent = formatMoney(totalRevenue);
      if (els.avgBilling) els.avgBilling.textContent = formatMoney(avgBilling);
      if (els.avgLOS) els.avgLOS.textContent = avgLOS ? avgLOS.toFixed(1) + ' days' : '—';
      if (els.hospitals) els.hospitals.textContent = formatNumber(uniqueHospitals);
    });
  }

  // Performance: Cache hospital stats
  let hospitalStatsCache = new Map();

  function computeHospitalStats(rows) {
    // Create cache key based on rows length and sample
    const cacheKey = rows.length + (rows[0]?.hospital || '') + (rows[rows.length - 1]?.hospital || '');
    if (hospitalStatsCache.has(cacheKey)) {
      return hospitalStatsCache.get(cacheKey);
    }

    // Optimized grouping using Map
    const byHosp = new Map();
    const len = rows.length;
    for (let i = 0; i < len; i++) {
      const r = rows[i];
      const hospital = r.hospital || 'Unknown';
      if (!byHosp.has(hospital)) {
        byHosp.set(hospital, []);
      }
      byHosp.get(hospital).push(r);
    }

    const out = [];
    for (const [hospital, list] of byHosp.entries()) {
      // Optimized calculations
      let billingSum = 0;
      let billingCount = 0;
      const testCounts = new Map();
      
      for (let i = 0; i < list.length; i++) {
        const r = list[i];
        if (r.billingAmount != null) {
          billingSum += r.billingAmount;
          billingCount++;
        }
        const tr = r.testResult || 'Inconclusive';
        testCounts.set(tr, (testCounts.get(tr) || 0) + 1);
      }
      
      const avgBilling = billingCount > 0 ? billingSum / billingCount : 0;
      
      // Find dominant test result
      let maxCount = 0;
      let dominant = 'Inconclusive';
      for (const [result, count] of testCounts) {
        if (count > maxCount) {
          maxCount = count;
          dominant = result;
        }
      }
      
      out.push({ hospital, count: list.length, avgBilling, dominantTestResult: dominant });
    }

    out.sort((a, b) => b.count - a.count);
    
    // Cache results (limit cache size)
    if (hospitalStatsCache.size > 20) {
      const firstKey = hospitalStatsCache.keys().next().value;
      hospitalStatsCache.delete(firstKey);
    }
    hospitalStatsCache.set(cacheKey, out);
    
    return out;
  }

  async function load() {
    // d3.csv row conversion is where we keep most of the cleanup.
    const rows = await d3.csv(window.App.config.dataPath, rowParser);
    window.App.state.raw = rows;

    // Populate filter dropdowns from what actually exists in the data.
    setSelectOptions('filter-gender', uniqueSorted(rows.map(d => d.gender)));
    setSelectOptions('filter-admission', uniqueSorted(rows.map(d => d.admissionType)));
    setSelectOptions('filter-condition', uniqueSorted(rows.map(d => d.medicalCondition)));
    setSelectOptions('filter-blood-type', uniqueSorted(rows.map(d => d.bloodType)));
    setSelectOptions('filter-insurance', uniqueSorted(rows.map(d => d.insurance)));
    setSelectOptions('filter-test-result', uniqueSorted(rows.map(d => d.testResult)));

    // Configure date input bounds.
    const dates = rows.map(d => d.admissionDate).filter(d => d instanceof Date && !Number.isNaN(d.getTime()));
    const extent = d3.extent(dates);
    const dateFromEl = document.getElementById('filter-date-from');
    const dateToEl = document.getElementById('filter-date-to');
    if (extent[0] && extent[1] && dateFromEl && dateToEl) {
      const fmt = d3.timeFormat('%Y-%m-%d');
      dateFromEl.min = fmt(extent[0]);
      dateFromEl.max = fmt(extent[1]);
      dateToEl.min = fmt(extent[0]);
      dateToEl.max = fmt(extent[1]);
    }

    updateMeta(rows.length, 'All');

    // Push filtered data to visuals.
    applyFilters();
    window.App.events.emit('data:loaded', { rows });
  }

  window.App.data = {
    load,
    applyFilters,
    computeHospitalStats,
    
    // Clear all caches (useful when data is reset)
    clearCaches() {
      clearCache();
      hospitalStatsCache.clear();
      lastKPIValues = null;
    },

    // Small helpers used by charts.
    setTestResultFilter(v) {
      window.App.state.filters.testResult = v || 'all';
      applyFilters();
    },
    setBillingRange(range) {
      window.App.state.filters.billingRange = range;
      applyFilters();
    }
  };
})();
