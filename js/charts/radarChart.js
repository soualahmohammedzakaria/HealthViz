(function () {
  if (!window.App) throw new Error('App state not initialized');

  const metrics = [
    { key: 'avgBilling', label: 'Avg Billing', unit: '$' },
    { key: 'avgLOS', label: 'Avg Stay (days)', unit: '' },
    { key: 'normalRate', label: 'Normal Rate', unit: '%' },
    { key: 'patientCount', label: 'Patient Volume', unit: '' },
    { key: 'urgentRate', label: 'Urgent/Emergency', unit: '%' }
  ];

  const colors = ['#1f4e79', '#b23a48', '#10b981', '#f59e0b', '#8b5cf6'];

  function buildData(rows) {
    const byCondition = d3.group(rows, d => d.medicalCondition || 'Unknown');
    const conditionCounts = Array.from(byCondition, ([condition, records]) => ({
      condition,
      count: records.length
    })).sort((a, b) => b.count - a.count);

    // Take top 5 conditions
    const topConditions = conditionCounts.slice(0, 5).map(c => c.condition);

    // Calculate global max for normalization
    const allStats = [];
    for (const condition of topConditions) {
      const records = byCondition.get(condition);
      const avgBilling = d3.mean(records, r => r.billingAmount) || 0;
      const avgLOS = d3.mean(records, r => r.lengthOfStay) || 0;
      const normalCount = records.filter(r => r.testResult === 'Normal').length;
      const normalRate = (normalCount / records.length) * 100;
      const urgentCount = records.filter(r => r.admissionType === 'Urgent' || r.admissionType === 'Emergency').length;
      const urgentRate = (urgentCount / records.length) * 100;
      
      allStats.push({
        condition,
        avgBilling,
        avgLOS,
        normalRate,
        patientCount: records.length,
        urgentRate
      });
    }

    // Normalize values to 0-100 scale
    const maxVals = {
      avgBilling: d3.max(allStats, d => d.avgBilling) || 1,
      avgLOS: d3.max(allStats, d => d.avgLOS) || 1,
      normalRate: 100,
      patientCount: d3.max(allStats, d => d.patientCount) || 1,
      urgentRate: 100
    };

    return allStats.map((s, i) => ({
      ...s,
      color: colors[i % colors.length],
      normalized: metrics.map(m => ({
        ...m,
        value: s[m.key],
        norm: (s[m.key] / maxVals[m.key]) * 100
      }))
    }));
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('g').attr('class', 'plot');
    svg.append('g').attr('class', 'legend');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Condition Comparison (Radar Chart)');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-radar');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const data = buildData(rows);

    if (!data.length) {
      svg.select('.plot').selectAll('*').remove();
      return;
    }

    const centerX = (w - 120) / 2;
    const centerY = h / 2 + 10;
    const radius = Math.min(centerX, centerY - 30) - 20;
    const levels = 5;
    const angleSlice = (Math.PI * 2) / metrics.length;

    const g = svg.select('.plot');
    g.attr('transform', `translate(${centerX}, ${centerY})`);

    // Clear previous
    g.selectAll('*').remove();

    // Draw grid circles
    for (let i = 1; i <= levels; i++) {
      const r = (radius / levels) * i;
      g.append('circle')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', '#e5e7eb')
        .attr('stroke-dasharray', '3,3');
    }

    // Draw axes
    metrics.forEach((m, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      g.append('line')
        .attr('x1', 0)
        .attr('y1', 0)
        .attr('x2', x)
        .attr('y2', y)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 1);

      // Labels
      const labelRadius = radius + 18;
      const lx = Math.cos(angle) * labelRadius;
      const ly = Math.sin(angle) * labelRadius;

      g.append('text')
        .attr('x', lx)
        .attr('y', ly)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('font-size', 9)
        .attr('fill', '#6b7280')
        .text(m.label);
    });

    // Radar line generator
    const radarLine = d3.lineRadial()
      .radius(d => (d.norm / 100) * radius)
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    // Draw each condition's radar
    data.forEach((condData, idx) => {
      const pathData = condData.normalized;

      // Area
      g.append('path')
        .datum(pathData)
        .attr('d', radarLine)
        .attr('fill', condData.color)
        .attr('fill-opacity', 0.15)
        .attr('stroke', condData.color)
        .attr('stroke-width', 2)
        .attr('stroke-opacity', 0.8);

      // Points
      pathData.forEach((d, i) => {
        const angle = angleSlice * i - Math.PI / 2;
        const r = (d.norm / 100) * radius;
        const px = Math.cos(angle) * r;
        const py = Math.sin(angle) * r;

        g.append('circle')
          .attr('cx', px)
          .attr('cy', py)
          .attr('r', 4)
          .attr('fill', condData.color)
          .attr('stroke', '#fff')
          .attr('stroke-width', 1.5)
          .style('cursor', 'pointer')
          .on('mousemove', (event) => {
            const valDisplay = d.unit === '$' 
              ? `$${d.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
              : d.unit === '%'
                ? `${d.value.toFixed(1)}%`
                : d.value.toLocaleString(undefined, { maximumFractionDigits: 1 });
            tooltip.show(
              `<div style="font-weight:600;">${condData.condition}</div>
              <div>${d.label}: ${valDisplay}</div>`,
              event.clientX,
              event.clientY
            );
          })
          .on('mouseleave', () => tooltip.hide());
      });
    });

    // Legend
    const legend = svg.select('.legend')
      .attr('transform', `translate(${w - 115}, ${30})`);

    legend.selectAll('*').remove();

    data.forEach((d, i) => {
      const ly = i * 20;
      legend.append('rect')
        .attr('x', 0)
        .attr('y', ly)
        .attr('width', 12)
        .attr('height', 12)
        .attr('fill', d.color)
        .attr('rx', 2);

      legend.append('text')
        .attr('x', 18)
        .attr('y', ly + 10)
        .attr('font-size', 10)
        .attr('fill', '#374151')
        .text(d.condition.length > 12 ? d.condition.slice(0, 12) + '…' : d.condition);
    });
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.radarChart = { init, update };
})();
