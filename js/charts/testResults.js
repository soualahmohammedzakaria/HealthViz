(function () {
  if (!window.App) throw new Error('App state not initialized');

  const palette = window.App.config.palette;
  const colors = {
    'Normal': '#1f4e79',
    'Abnormal': '#b23a48',
    'Inconclusive': '#6b7280'
  };

  function buildCounts(rows) {
    const keys = ['Normal', 'Abnormal', 'Inconclusive'];
    const counts = new Map(keys.map(k => [k, 0]));
    for (const r of rows) {
      const k = r.testResult || 'Inconclusive';
      counts.set(k, (counts.get(k) || 0) + 1);
    }
    return keys.map(k => ({ key: k, value: counts.get(k) || 0 }));
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('g').attr('class', 'plot');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Distribution of Test Results');

    // Legend
    const legend = svg.append('g').attr('class', 'legend');

    root.__chart = { svg, legend };
  }

  function update(rows) {
    const root = document.getElementById('chart-test-results');
    if (!root || !root.__chart) return;

    const { svg, legend } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 400;
    const h = root.clientHeight || 320;

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const data = buildCounts(rows);
    const total = d3.sum(data, d => d.value) || 1;

    // Donut chart dimensions
    const radius = Math.min(w, h - 40) / 2 - 20;
    const innerRadius = radius * 0.5;
    const centerX = w / 2;
    const centerY = (h + 20) / 2;

    const pie = d3.pie()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.02);

    const arc = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius)
      .cornerRadius(4);

    const arcHover = d3.arc()
      .innerRadius(innerRadius)
      .outerRadius(radius + 8)
      .cornerRadius(4);

    const plotG = svg.select('.plot')
      .attr('transform', `translate(${centerX},${centerY})`);

    const arcs = pie(data);

    const active = window.App.state.filters.testResult;

    // Bind data
    const paths = plotG.selectAll('path.slice')
      .data(arcs, d => d.data.key);

    // Enter
    paths.enter()
      .append('path')
      .attr('class', 'slice')
      .attr('fill', d => colors[d.data.key] || '#6b7280')
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
        const pct = ((d.data.value / total) * 100).toFixed(1);
        tooltip.show(
          `<div style="font-weight:600;">${d.data.key}</div>` +
          `<div>${d.data.value.toLocaleString()} patients (${pct}%)</div>`,
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
      .attr('opacity', d => (active === 'all' || active === d.data.key) ? 1 : 0.35)
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
        .attr('font-size', 14)
        .attr('font-weight', 600)
        .attr('fill', '#374151');
    }
    centerText.text(`${total.toLocaleString()} total`);

    // Legend
    legend.attr('transform', `translate(${w - 130}, ${30})`);
    
    const legendItems = legend.selectAll('g.legend-item')
      .data(data, d => d.key);

    const legendEnter = legendItems.enter()
      .append('g')
      .attr('class', 'legend-item');

    legendEnter.append('rect')
      .attr('width', 12)
      .attr('height', 12)
      .attr('rx', 3);

    legendEnter.append('text')
      .attr('x', 18)
      .attr('y', 10)
      .attr('font-size', 11)
      .attr('fill', '#374151');

    legendEnter.merge(legendItems)
      .attr('transform', (d, i) => `translate(0, ${i * 22})`)
      .select('rect')
      .attr('fill', d => colors[d.key] || '#6b7280');

    legendEnter.merge(legendItems)
      .select('text')
      .text(d => {
        const pct = ((d.value / total) * 100).toFixed(0);
        return `${d.key} (${pct}%)`;
      });

    legendItems.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.testResults = { init, update };
})();
