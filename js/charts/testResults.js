(function () {
  if (!window.App) throw new Error('App state not initialized');

  const palette = window.App.config.palette;

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
    svg.append('g').attr('class', 'x-axis');
    svg.append('g').attr('class', 'y-axis');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Distribution of Test Results');

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

    // Simple legend
    const legend = svg.append('g').attr('class', 'legend');
    const entries = ['Normal', 'Abnormal', 'Inconclusive'];
    const legendItem = legend.selectAll('g').data(entries).enter().append('g');
    legendItem.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('rx', 2)
      .attr('fill', d => palette[d] || '#6b7280');
    legendItem.append('text')
      .attr('x', 14)
      .attr('y', 9)
      .attr('font-size', 11)
      .attr('fill', '#374151')
      .text(d => d);

    root.__chart = { svg, legend };
  }

  function update(rows) {
    const root = document.getElementById('chart-test-results');
    if (!root || !root.__chart) return;

    const { svg, legend } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 400;
    const h = root.clientHeight || 320;
    const margin = { top: 28, right: 12, bottom: 36, left: 60 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const data = buildCounts(rows);

    const x = d3.scaleBand()
      .domain(data.map(d => d.key))
      .range([margin.left, w - margin.right])
      .padding(0.25);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.value) || 1])
      .nice()
      .range([h - margin.bottom, margin.top + 10]);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x));

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(5));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 6)
      .text('Test Result');

    svg.select('.y-label')
      .attr('x', -((margin.top + h - margin.bottom) / 2))
      .attr('y', 12)
      .text('Patient count');

    // Legend layout
    legend.attr('transform', `translate(${w - margin.right - 220}, ${8})`);
    legend.selectAll('g')
      .attr('transform', (d, i) => `translate(${i * 74}, 0)`);

    const active = window.App.state.filters.testResult;

    const bars = svg.select('.plot')
      .selectAll('rect.bar')
      .data(data, d => d.key);

    bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.key))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('rx', 6)
      .attr('fill', d => palette[d.key] || '#6b7280')
      .style('cursor', 'default')
      .on('mousemove', (event, d) => {
        tooltip.show(`<div style="font-weight:600;">${d.key}</div><div>${d.value.toLocaleString()} patients</div>`, event.clientX, event.clientY);
      })
      .on('mouseleave', () => tooltip.hide())
      .merge(bars)
      .attr('opacity', d => (active === 'all' || active === d.key) ? 1 : 0.35)
      .transition()
      .duration(250)
      .attr('x', d => x(d.key))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.value))
      .attr('height', d => Math.max(0, y(0) - y(d.value)));

    bars.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.testResults = { init, update };
})();
