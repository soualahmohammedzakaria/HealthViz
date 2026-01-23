(function () {
  if (!window.App) throw new Error('App state not initialized');

  const dimensions = [
    { key: 'age', label: 'Age', type: 'linear' },
    { key: 'billingAmount', label: 'Billing ($)', type: 'linear' },
    { key: 'lengthOfStayDays', label: 'Stay (days)', type: 'linear' },
    { key: 'admissionType', label: 'Admission', type: 'ordinal' },
    { key: 'testResult', label: 'Test Result', type: 'ordinal' }
  ];

  const resultColors = {
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

    svg.append('g').attr('class', 'plot');
    svg.append('g').attr('class', 'axes');
    svg.append('g').attr('class', 'legend');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Multi-Dimensional Patient View (Parallel Coordinates)');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-parallel');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 920;
    const h = root.clientHeight || 320;
    const margin = { top: 40, right: 40, bottom: 30, left: 40 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    // Sample data for performance
    let data = rows.filter(r => 
      r.age != null && 
      r.billingAmount != null && 
      r.lengthOfStayDays != null
    );
    
    if (data.length > 300) {
      const step = Math.ceil(data.length / 300);
      data = data.filter((_, i) => i % step === 0);
    }

    if (!data.length) {
      svg.select('.plot').selectAll('*').remove();
      svg.select('.axes').selectAll('*').remove();
      return;
    }

    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    // Create scales for each dimension
    const xScale = d3.scalePoint()
      .domain(dimensions.map(d => d.key))
      .range([0, innerW])
      .padding(0.1);

    const yScales = {};
    dimensions.forEach(dim => {
      if (dim.type === 'linear') {
        const extent = d3.extent(data, d => d[dim.key]);
        yScales[dim.key] = d3.scaleLinear()
          .domain([extent[0] || 0, extent[1] || 1])
          .range([innerH, 0])
          .nice();
      } else {
        const values = Array.from(new Set(data.map(d => d[dim.key]).filter(Boolean))).sort();
        yScales[dim.key] = d3.scalePoint()
          .domain(values)
          .range([innerH, 0])
          .padding(0.5);
      }
    });

    const g = svg.select('.plot')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const axesG = svg.select('.axes')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    g.selectAll('*').remove();
    axesG.selectAll('*').remove();

    // Line generator
    const line = d3.line()
      .defined(([, value]) => value != null)
      .x(([key]) => xScale(key))
      .y(([key, value]) => {
        const scale = yScales[key];
        return scale ? scale(value) : 0;
      });

    // Draw lines
    const lines = g.selectAll('path.parallel-line')
      .data(data)
      .enter()
      .append('path')
      .attr('class', 'parallel-line')
      .attr('d', d => {
        const points = dimensions.map(dim => [dim.key, d[dim.key]]);
        return line(points);
      })
      .attr('fill', 'none')
      .attr('stroke', d => resultColors[d.testResult] || '#6b7280')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        // Highlight this line
        d3.select(this)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', 2.5)
          .raise();
        
        const fmt = window.App.utils?.format?.formatMoney;
        const billing = fmt ? fmt(d.billingAmount) : `$${d.billingAmount.toLocaleString()}`;
        
        tooltip.show(
          `<div style="font-weight:600;">${d.name || 'Patient'}</div>
          <div>Age: ${d.age} years</div>
          <div>Billing: ${billing}</div>
          <div>Stay: ${d.lengthOfStayDays} days</div>
          <div>Admission: ${d.admissionType || 'N/A'}</div>
          <div>Test Result: ${d.testResult || 'N/A'}</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function() {
        d3.select(this)
          .attr('stroke-opacity', 0.3)
          .attr('stroke-width', 1.5);
        tooltip.hide();
      });

    // Draw axes
    dimensions.forEach(dim => {
      const xPos = xScale(dim.key);
      const scale = yScales[dim.key];

      // Axis line
      axesG.append('line')
        .attr('x1', xPos)
        .attr('x2', xPos)
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#d1d5db')
        .attr('stroke-width', 1);

      // Axis
      const axis = dim.type === 'linear' 
        ? d3.axisLeft(scale).ticks(5).tickFormat(d => {
            if (dim.key === 'billingAmount') return d >= 1000 ? `${d/1000}k` : d;
            return d;
          })
        : d3.axisLeft(scale);

      axesG.append('g')
        .attr('transform', `translate(${xPos},0)`)
        .call(axis)
        .selectAll('text')
        .attr('font-size', 9);

      // Axis label
      axesG.append('text')
        .attr('x', xPos)
        .attr('y', -10)
        .attr('text-anchor', 'middle')
        .attr('font-size', 10)
        .attr('font-weight', 600)
        .attr('fill', '#374151')
        .text(dim.label);
    });

    // Legend
    const legend = svg.select('.legend')
      .attr('transform', `translate(${w - 100}, ${margin.top})`);

    legend.selectAll('*').remove();

    Object.entries(resultColors).forEach(([label, color], i) => {
      const ly = i * 18;
      legend.append('line')
        .attr('x1', 0)
        .attr('x2', 16)
        .attr('y1', ly + 5)
        .attr('y2', ly + 5)
        .attr('stroke', color)
        .attr('stroke-width', 2);

      legend.append('text')
        .attr('x', 22)
        .attr('y', ly + 9)
        .attr('font-size', 10)
        .attr('fill', '#374151')
        .text(label);
    });
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.parallelCoords = { init, update };
})();
