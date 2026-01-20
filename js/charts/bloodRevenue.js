(function () {
  if (!window.App) throw new Error('App state not initialized');

  // Cache for preventing unnecessary redraws
  let lastDataHash = null;
  let chartState = null;

  function hashData(data) {
    if (!data || !data.length) return '';
    return data.map(d => `${d.bloodType}:${d.revenue.toFixed(0)}`).join('|');
  }

  const colors = ['#1f4e79', '#2a6f97', '#4a8ab3', '#6fa3c4', '#94bcd5', '#b23a48', '#d05661', '#6b7280'];

  function init(root) {
    const container = typeof root === 'string' ? document.getElementById(root) : root;
    if (!container) return;
    
    container.innerHTML = '';
    
    const svg = d3.select(container)
      .append('svg')
      .attr('class', 'blood-chart-svg')
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
      .text('Revenue by Blood Type');
    
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
      svg.select('.legend').selectAll('*').remove();
      return;
    }

    const { tooltip } = window.App.utils;
    const fmt = window.App.utils?.format?.formatMoney;

    // Calculate total billing amount per blood type
    const blood_stats = new Map();
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const blood = row.bloodType || 'Unknown';
      blood_stats.set(blood, (blood_stats.get(blood) || 0) + (row.billingAmount || 0));
    }

    const data = Array.from(blood_stats.entries())
      .map(([bloodType, revenue]) => ({ bloodType, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Check if data changed
    const currentHash = hashData(data);
    if (currentHash === lastDataHash) return;
    lastDataHash = currentHash;

    const w = container.offsetWidth || 400;
    const h = container.offsetHeight || 320;

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const total = d3.sum(data, d => d.revenue) || 1;

    // Donut chart dimensions
    const radius = Math.min(w - 140, h - 40) / 2 - 10;
    const innerRadius = radius * 0.55;
    const centerX = (w - 120) / 2;
    const centerY = (h + 20) / 2;

    const pie = d3.pie()
      .value(d => d.revenue)
      .sort(null)
      .padAngle(0.02);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(3);

    const arcHover = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius + 6)
      .cornerRadius(3);

    const plotG = svg.select('.plot')
      .attr('transform', `translate(${centerX},${centerY})`);

    const arcs = pie(data);

    // Bind data
    const paths = plotG.selectAll('path.slice')
      .data(arcs, d => d.data.bloodType);

    // Enter
    paths.enter()
      .append('path')
      .attr('class', 'slice')
      .attr('fill', (d, i) => colors[i % colors.length])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .each(function(d) { this._current = d; })
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition().duration(150)
          .attr('d', arcHover);
      })
      .on('mousemove', (event, d) => {
        const pct = ((d.data.revenue / total) * 100).toFixed(1);
        const revStr = fmt ? fmt(d.data.revenue) : `$${d.data.revenue.toLocaleString()}`;
        tooltip.show(
          `<div style="font-weight:600;">${d.data.bloodType}</div>` +
          `<div>${revStr} (${pct}%)</div>`,
          event.clientX, event.clientY
        );
      })
      .on('mouseleave', function() {
        d3.select(this)
          .transition().duration(150)
          .attr('d', arc);
        tooltip.hide();
      })
      .merge(paths)
      .transition()
      .duration(400)
      .attrTween('d', function(d) {
        const interp = d3.interpolate(this._current, d);
        this._current = interp(1);
        return t => arc(interp(t));
      });

    paths.exit().remove();

    // Center label showing total
    let centerText = plotG.select('text.center-label');
    if (centerText.empty()) {
      centerText = plotG.append('text')
        .attr('class', 'center-label')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-size', 13)
        .attr('font-weight', 600)
        .attr('fill', '#374151');
    }
    const totalStr = fmt ? fmt(total) : `$${(total/1000000).toFixed(1)}M`;
    centerText.text(totalStr);

    // Legend on the right
    const legend = svg.select('.legend')
      .attr('transform', `translate(${w - 115}, ${35})`);
    
    const legendItems = legend.selectAll('g.legend-item')
      .data(data.slice(0, 8), d => d.bloodType);

    const legendEnter = legendItems.enter()
      .append('g')
      .attr('class', 'legend-item');

    legendEnter.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2);

    legendEnter.append('text')
      .attr('x', 14)
      .attr('y', 9)
      .attr('font-size', 10)
      .attr('fill', '#374151');

    legendEnter.merge(legendItems)
      .attr('transform', (d, i) => `translate(0, ${i * 18})`)
      .select('rect')
      .attr('fill', (d, i) => colors[i % colors.length]);

    legendEnter.merge(legendItems)
      .select('text')
      .text(d => {
        const pct = ((d.revenue / total) * 100).toFixed(0);
        return `${d.bloodType} (${pct}%)`;
      });

    legendItems.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.bloodRevenue = { init, update };
})();
