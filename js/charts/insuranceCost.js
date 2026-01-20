(function () {
  if (!window.App) throw new Error('App state not initialized');

  // Cache for preventing unnecessary redraws
  let lastDataHash = null;
  let chartState = null;

  function hashData(data) {
    if (!data || !data.length) return '';
    return data.map(d => `${d.insurance}:${d.avgCost.toFixed(2)}`).join('|');
  }

  const colors = {
    line: '#1f4e79',
    area: 'rgba(31, 78, 121, 0.15)',
    dot: '#1f4e79',
    dotHover: '#b23a48'
  };

  function init(root) {
    const container = typeof root === 'string' ? document.getElementById(root) : root;
    if (!container) return;
    
    container.innerHTML = '';
    
    const svg = d3.select(container)
      .append('svg')
      .attr('class', 'insurance-chart-svg')
      .attr('width', '100%')
      .attr('height', '100%');
    
    svg.append('g').attr('class', 'plot');
    svg.append('g').attr('class', 'x-axis');
    svg.append('g').attr('class', 'y-axis');
    
    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Avg. Cost by Insurance');

    svg.append('text')
      .attr('class', 'x-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#6b7280');

    svg.append('text')
      .attr('class', 'y-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#6b7280')
      .attr('transform', 'rotate(-90)');
    
    chartState = { svg, container };
    lastDataHash = null;
  }

  function update(rows) {
    if (!chartState) return;
    
    const { svg, container } = chartState;
    if (!svg || !container) return;

    const filteredRows = rows || window.App.state.filtered || [];
    if (!filteredRows.length) {
      svg.select('.plot').selectAll('*').remove();
      return;
    }

    const { tooltip } = window.App.utils;

    // Calculate average billing amount per insurance provider
    const insurance_stats = new Map();
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const ins = row.insurance || 'Unknown';
      if (!insurance_stats.has(ins)) {
        insurance_stats.set(ins, { total: 0, count: 0 });
      }
      const stat = insurance_stats.get(ins);
      stat.total += row.billingAmount || 0;
      stat.count += 1;
    }

    const data = Array.from(insurance_stats.entries())
      .map(([insurance, stats]) => ({
        insurance,
        avgCost: stats.count > 0 ? stats.total / stats.count : 0,
        count: stats.count
      }))
      .sort((a, b) => b.avgCost - a.avgCost);

    // Check if data changed
    const currentHash = hashData(data);
    if (currentHash === lastDataHash) return;
    lastDataHash = currentHash;

    const w = container.offsetWidth || 520;
    const h = container.offsetHeight || 320;
    const margin = { top: 28, right: 20, bottom: 50, left: 60 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const x = d3.scalePoint()
      .domain(data.map(d => d.insurance))
      .range([margin.left, w - margin.right])
      .padding(0.5);

    const maxY = d3.max(data, d => d.avgCost) || 1;
    const y = d3.scaleLinear()
      .domain([0, maxY * 1.1])
      .nice()
      .range([h - margin.bottom, margin.top + 10]);

    // Axes
    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'rotate(-25)')
      .attr('text-anchor', 'end')
      .attr('dx', '-0.5em')
      .attr('dy', '0.5em')
      .attr('font-size', 10);

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `$${(d/1000).toFixed(0)}k`));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 6)
      .text('Insurance Provider');

    svg.select('.y-label')
      .attr('x', -((margin.top + h - margin.bottom) / 2))
      .attr('y', 14)
      .text('Avg. Billing ($)');

    const plotG = svg.select('.plot');

    // Area generator
    const area = d3.area()
      .x(d => x(d.insurance))
      .y0(h - margin.bottom)
      .y1(d => y(d.avgCost))
      .curve(d3.curveMonotoneX);

    // Line generator
    const line = d3.line()
      .x(d => x(d.insurance))
      .y(d => y(d.avgCost))
      .curve(d3.curveMonotoneX);

    // Area path
    let areaPath = plotG.select('path.area');
    if (areaPath.empty()) {
      areaPath = plotG.append('path')
        .attr('class', 'area')
        .attr('fill', colors.area);
    }
    areaPath.transition().duration(400)
      .attr('d', area(data));

    // Line path
    let linePath = plotG.select('path.line');
    if (linePath.empty()) {
      linePath = plotG.append('path')
        .attr('class', 'line')
        .attr('fill', 'none')
        .attr('stroke', colors.line)
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-linejoin', 'round');
    }
    linePath.transition().duration(400)
      .attr('d', line(data));

    // Data points (circles)
    const dots = plotG.selectAll('circle.dot')
      .data(data, d => d.insurance);

    dots.enter()
      .append('circle')
      .attr('class', 'dot')
      .attr('r', 5)
      .attr('fill', colors.dot)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .attr('cx', d => x(d.insurance))
      .attr('cy', y(0))
      .on('mouseenter', function() {
        d3.select(this)
          .transition().duration(150)
          .attr('r', 8)
          .attr('fill', colors.dotHover);
      })
      .on('mousemove', (event, d) => {
        tooltip.show(
          `<div style="font-weight:600;">${d.insurance}</div>` +
          `<div>Avg: $${d.avgCost.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}</div>` +
          `<div>${d.count.toLocaleString()} patients</div>`,
          event.clientX, event.clientY
        );
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition().duration(150)
          .attr('r', 5)
          .attr('fill', colors.dot);
        tooltip.hide();
      })
      .merge(dots)
      .transition().duration(400)
      .attr('cx', d => x(d.insurance))
      .attr('cy', d => y(d.avgCost));

    dots.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.insuranceCost = { init, update };
})();
