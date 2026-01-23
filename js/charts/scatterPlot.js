(function () {
  if (!window.App) throw new Error('App state not initialized');

  const colors = {
    'Normal': '#1f4e79',
    'Abnormal': '#b23a48',
    'Inconclusive': '#6b7280'
  };

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('defs').append('clipPath')
      .attr('id', 'scatter-clip')
      .append('rect');

    svg.append('g').attr('class', 'grid');
    svg.append('g').attr('class', 'plot');
    svg.append('g').attr('class', 'x-axis');
    svg.append('g').attr('class', 'y-axis');
    svg.append('g').attr('class', 'brush');
    svg.append('g').attr('class', 'legend');

    // Selection info text
    svg.append('text')
      .attr('class', 'selection-info')
      .attr('font-size', 10)
      .attr('fill', '#6b7280');

    root.__chart = { svg, brushSelection: null };
  }

  function update(rows) {
    const root = document.getElementById('chart-scatter');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;
    const fmt = window.App.utils?.format?.formatMoney;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;
    const margin = { top: 32, right: 100, bottom: 50, left: 70 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    // Sample data for performance (max 500 points)
    let data = rows.filter(r => r.age != null && r.billingAmount != null);
    const fullData = data;
    if (data.length > 500) {
      const step = Math.ceil(data.length / 500);
      data = data.filter((_, i) => i % step === 0);
    }

    if (!data.length) {
      svg.select('.plot').selectAll('*').remove();
      svg.select('.grid').selectAll('*').remove();
      return;
    }

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.age) || 100])
      .nice()
      .range([margin.left, w - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.billingAmount) || 50000])
      .nice()
      .range([h - margin.bottom, margin.top]);

    // Draw horizontal grid lines
    const gridG = svg.select('.grid');
    gridG.selectAll('*').remove();
    
    const yTicks = y.ticks(6);
    gridG.selectAll('line.grid-line')
      .data(yTicks)
      .enter()
      .append('line')
      .attr('class', 'grid-line')
      .attr('x1', margin.left)
      .attr('x2', w - margin.right)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d))
      .attr('stroke', '#e5e7eb')
      .attr('stroke-dasharray', '3,3');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Age vs Billing Amount');

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

    // Update clip rect
    svg.select('#scatter-clip rect')
      .attr('x', margin.left)
      .attr('y', margin.top)
      .attr('width', w - margin.left - margin.right)
      .attr('height', h - margin.top - margin.bottom);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(8));

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6).tickFormat(d => d >= 1000 ? `$${d / 1000}k` : `$${d}`));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 8)
      .text('Patient Age (years)');

    svg.select('.y-label')
      .attr('x', -(margin.top + h - margin.bottom) / 2)
      .attr('y', 18)
      .text('Billing Amount ($)');

    const g = svg.select('.plot')
      .attr('clip-path', 'url(#scatter-clip)');

    // Points
    const points = g.selectAll('circle.point')
      .data(data, (d, i) => `${d.age}-${d.billingAmount}-${i}`);

    points.exit().remove();

    points.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('r', 0)
      .attr('cx', d => x(d.age))
      .attr('cy', d => y(d.billingAmount))
      .attr('fill', d => colors[d.testResult] || colors['Inconclusive'])
      .attr('opacity', 0.6)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.5)
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        const billing = fmt ? fmt(d.billingAmount) : `$${d.billingAmount.toLocaleString()}`;
        tooltip.show(
          `<div style="font-weight:600;">${d.name || 'Patient'}</div>
          <div>Age: ${d.age} years</div>
          <div>Billing: ${billing}</div>
          <div>Condition: ${d.medicalCondition || 'N/A'}</div>
          <div>Test Result: ${d.testResult || 'N/A'}</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', () => tooltip.hide())
      .transition()
      .duration(400)
      .attr('r', 5);

    points.transition()
      .duration(400)
      .attr('cx', d => x(d.age))
      .attr('cy', d => y(d.billingAmount))
      .attr('fill', d => colors[d.testResult] || colors['Inconclusive']);

    // Legend
    const legend = svg.select('.legend')
      .attr('transform', `translate(${w - 90}, ${margin.top + 10})`);

    legend.selectAll('*').remove();

    const legendData = ['Normal', 'Abnormal', 'Inconclusive'];
    legendData.forEach((label, i) => {
      const ly = i * 20;
      legend.append('circle')
        .attr('cx', 6)
        .attr('cy', ly + 6)
        .attr('r', 5)
        .attr('fill', colors[label]);

      legend.append('text')
        .attr('x', 18)
        .attr('y', ly + 10)
        .attr('font-size', 10)
        .attr('fill', '#374151')
        .text(label);
    });

    // Brush for selection
    const brush = d3.brush()
      .extent([[margin.left, margin.top], [w - margin.right, h - margin.bottom]])
      .on('start brush', function(event) {
        if (!event.selection) return;
        const [[x0, y0], [x1, y1]] = event.selection;
        
        // Highlight points in selection
        g.selectAll('circle.point')
          .attr('opacity', d => {
            const px = x(d.age);
            const py = y(d.billingAmount);
            const inBrush = px >= x0 && px <= x1 && py >= y0 && py <= y1;
            return inBrush ? 1 : 0.15;
          })
          .attr('r', d => {
            const px = x(d.age);
            const py = y(d.billingAmount);
            const inBrush = px >= x0 && px <= x1 && py >= y0 && py <= y1;
            return inBrush ? 6 : 4;
          });

        // Count selected points
        const selectedCount = data.filter(d => {
          const px = x(d.age);
          const py = y(d.billingAmount);
          return px >= x0 && px <= x1 && py >= y0 && py <= y1;
        }).length;

        // Show selection info
        const ageRange = [x.invert(x0).toFixed(0), x.invert(x1).toFixed(0)];
        const billingRange = [y.invert(y1), y.invert(y0)];
        const billingStr = billingRange.map(v => v >= 1000 ? `$${(v/1000).toFixed(0)}k` : `$${v.toFixed(0)}`).join(' - ');
        
        svg.select('.selection-info')
          .attr('x', margin.left + 5)
          .attr('y', margin.top + 15)
          .text(`Selected: ${selectedCount} patients | Age: ${ageRange[0]}-${ageRange[1]} | Billing: ${billingStr}`);
      })
      .on('end', function(event) {
        if (!event.selection) {
          // Reset all points
          g.selectAll('circle.point')
            .attr('opacity', 0.6)
            .attr('r', 5);
          svg.select('.selection-info').text('');
          root.__chart.brushSelection = null;
        } else {
          root.__chart.brushSelection = event.selection;
        }
      });

    svg.select('.brush').call(brush);

    // Style brush selection rectangle
    svg.select('.brush .selection')
      .attr('fill', '#1f4e79')
      .attr('fill-opacity', 0.1)
      .attr('stroke', '#1f4e79')
      .attr('stroke-width', 1);
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.scatterPlot = { init, update };
})();
