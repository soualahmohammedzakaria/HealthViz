(function () {
  if (!window.App) throw new Error('App state not initialized');

  const barColor = '#1f4e79';
  const barHoverColor = '#2a6f97';

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
      .text('Patient Age Distribution (Histogram)');

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

    // Mean line group
    svg.append('g').attr('class', 'mean-line');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-histogram');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;
    const margin = { top: 32, right: 20, bottom: 50, left: 60 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const ages = rows.map(r => r.age).filter(a => a != null && !isNaN(a));

    if (!ages.length) {
      svg.select('.plot').selectAll('*').remove();
      return;
    }

    const minAge = d3.min(ages);
    const maxAge = d3.max(ages);
    const meanAge = d3.mean(ages);
    const medianAge = d3.median(ages);

    const x = d3.scaleLinear()
      .domain([Math.floor(minAge / 10) * 10, Math.ceil(maxAge / 10) * 10])
      .range([margin.left, w - margin.right]);

    const histogram = d3.histogram()
      .value(d => d)
      .domain(x.domain())
      .thresholds(x.ticks(15));

    const bins = histogram(ages);

    const y = d3.scaleLinear()
      .domain([0, d3.max(bins, d => d.length) * 1.1])
      .nice()
      .range([h - margin.bottom, margin.top]);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(10));

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 8)
      .text('Age (years)');

    svg.select('.y-label')
      .attr('x', -(margin.top + h - margin.bottom) / 2)
      .attr('y', 16)
      .text('Number of Patients');

    const g = svg.select('.plot');

    // Bars
    const bars = g.selectAll('rect.bar')
      .data(bins);

    bars.exit().remove();

    bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', d => x(d.x0) + 1)
      .attr('y', h - margin.bottom)
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr('height', 0)
      .attr('fill', barColor)
      .attr('rx', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function() {
        d3.select(this).attr('fill', barHoverColor);
      })
      .on('mousemove', (event, d) => {
        const pct = ((d.length / ages.length) * 100).toFixed(1);
        tooltip.show(
          `<div style="font-weight:600;">Age ${d.x0}–${d.x1}</div>
          <div>Patients: ${d.length.toLocaleString()}</div>
          <div>Percentage: ${pct}%</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function() {
        d3.select(this).attr('fill', barColor);
        tooltip.hide();
      })
      .merge(bars)
      .transition()
      .duration(400)
      .attr('x', d => x(d.x0) + 1)
      .attr('y', d => y(d.length))
      .attr('width', d => Math.max(0, x(d.x1) - x(d.x0) - 2))
      .attr('height', d => Math.max(0, h - margin.bottom - y(d.length)));

    // Mean line
    const meanG = svg.select('.mean-line');
    meanG.selectAll('*').remove();

    meanG.append('line')
      .attr('x1', x(meanAge))
      .attr('x2', x(meanAge))
      .attr('y1', margin.top)
      .attr('y2', h - margin.bottom)
      .attr('stroke', '#b23a48')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '5,3');

    meanG.append('text')
      .attr('x', x(meanAge) + 5)
      .attr('y', margin.top + 12)
      .attr('font-size', 10)
      .attr('fill', '#b23a48')
      .attr('font-weight', 600)
      .text(`Mean: ${meanAge.toFixed(1)}`);

    // Median indicator
    meanG.append('line')
      .attr('x1', x(medianAge))
      .attr('x2', x(medianAge))
      .attr('y1', margin.top)
      .attr('y2', h - margin.bottom)
      .attr('stroke', '#10b981')
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', '2,2');

    meanG.append('text')
      .attr('x', x(medianAge) + 5)
      .attr('y', margin.top + 26)
      .attr('font-size', 10)
      .attr('fill', '#10b981')
      .attr('font-weight', 600)
      .text(`Median: ${medianAge.toFixed(1)}`);
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.histogram = { init, update };
})();
