(function () {
  if (!window.App) throw new Error('App state not initialized');

  function buildMatrix(rows) {
    const conditions = Array.from(new Set(rows.map(r => r.medicalCondition).filter(Boolean))).sort();
    const medications = Array.from(new Set(rows.map(r => r.medication).filter(Boolean))).sort();

    // Create count matrix
    const matrix = [];
    const countMap = new Map();
    
    for (const r of rows) {
      const key = `${r.medicalCondition}__${r.medication}`;
      countMap.set(key, (countMap.get(key) || 0) + 1);
    }

    conditions.forEach((condition, ci) => {
      medications.forEach((medication, mi) => {
        const key = `${condition}__${medication}`;
        const count = countMap.get(key) || 0;
        matrix.push({
          condition,
          medication,
          count,
          ci,
          mi
        });
      });
    });

    return { matrix, conditions, medications, maxCount: d3.max(matrix, d => d.count) || 1 };
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('g').attr('class', 'plot');
    svg.append('g').attr('class', 'x-axis');
    svg.append('g').attr('class', 'y-axis');
    svg.append('g').attr('class', 'color-legend');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Medication Usage by Condition (Heatmap)');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-heatmap');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 680;
    const h = root.clientHeight || 320;
    const margin = { top: 32, right: 80, bottom: 80, left: 100 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const { matrix, conditions, medications, maxCount } = buildMatrix(rows);

    if (!conditions.length || !medications.length) {
      svg.select('.plot').selectAll('*').remove();
      return;
    }

    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const x = d3.scaleBand()
      .domain(medications)
      .range([0, innerW])
      .padding(0.05);

    const y = d3.scaleBand()
      .domain(conditions)
      .range([0, innerH])
      .padding(0.05);

    const colorScale = d3.scaleSequential()
      .domain([0, maxCount])
      .interpolator(d3.interpolateBlues);

    const g = svg.select('.plot')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    g.selectAll('*').remove();

    // Cells
    g.selectAll('rect.cell')
      .data(matrix)
      .enter()
      .append('rect')
      .attr('class', 'cell heatmap-cell')
      .attr('x', d => x(d.medication))
      .attr('y', d => y(d.condition))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => d.count > 0 ? colorScale(d.count) : '#f3f4f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        const total = rows.filter(r => r.medicalCondition === d.condition).length;
        const pct = total > 0 ? ((d.count / total) * 100).toFixed(1) : 0;
        tooltip.show(
          `<div style="font-weight:600;">${d.condition}</div>
          <div>Medication: ${d.medication}</div>
          <div>Patients: ${d.count.toLocaleString()}</div>
          <div>% of condition: ${pct}%</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', () => tooltip.hide());

    // X axis
    svg.select('.x-axis')
      .attr('transform', `translate(${margin.left},${margin.top + innerH})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('font-size', 10)
      .attr('transform', 'rotate(-45)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.5em');

    // Y axis
    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .call(d3.axisLeft(y))
      .selectAll('text')
      .attr('font-size', 10);

    // Color legend
    const legendW = 15;
    const legendH = innerH;
    const legendG = svg.select('.color-legend')
      .attr('transform', `translate(${w - margin.right + 20},${margin.top})`);

    legendG.selectAll('*').remove();

    // Gradient
    const gradientId = 'heatmap-gradient';
    const defs = svg.select('defs').empty() ? svg.append('defs') : svg.select('defs');
    
    defs.selectAll(`#${gradientId}`).remove();
    
    const gradient = defs.append('linearGradient')
      .attr('id', gradientId)
      .attr('x1', '0%')
      .attr('x2', '0%')
      .attr('y1', '100%')
      .attr('y2', '0%');

    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', colorScale(0));

    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', colorScale(maxCount));

    legendG.append('rect')
      .attr('width', legendW)
      .attr('height', legendH)
      .attr('fill', `url(#${gradientId})`)
      .attr('stroke', '#d1d5db')
      .attr('rx', 2);

    // Legend axis
    const legendScale = d3.scaleLinear()
      .domain([0, maxCount])
      .range([legendH, 0]);

    legendG.append('g')
      .attr('transform', `translate(${legendW},0)`)
      .call(d3.axisRight(legendScale).ticks(5).tickFormat(d3.format('.0f')))
      .selectAll('text')
      .attr('font-size', 9);

    legendG.append('text')
      .attr('x', legendW / 2)
      .attr('y', -8)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#6b7280')
      .text('Count');
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.heatmapMatrix = { init, update };
})();
