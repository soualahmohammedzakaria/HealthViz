(function () {
  if (!window.App) throw new Error('App state not initialized');

  function formatMoney(value) {
    if (value == null || Number.isNaN(value)) return '—';
    
    const absValue = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    
    if (absValue >= 1e9) {
      return sign + '$' + (absValue / 1e9).toFixed(1) + 'B';
    } else if (absValue >= 1e6) {
      return sign + '$' + (absValue / 1e6).toFixed(1) + 'M';
    } else if (absValue >= 1e3) {
      return sign + '$' + (absValue / 1e3).toFixed(1) + 'K';
    } else {
      return sign + '$' + absValue.toFixed(0);
    }
  }

  function formatNumber(value) {
    if (value == null || Number.isNaN(value)) return '—';
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }

  function formatDays(days) {
    if (days == null || Number.isNaN(days)) return '—';
    return `${Math.round(days)} d`;
  }

  window.App.utils = window.App.utils || {};
  window.App.utils.format = { formatMoney, formatNumber, formatDays };
})();
