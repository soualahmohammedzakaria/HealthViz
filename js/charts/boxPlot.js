(function () {
  if (!window.App) throw new Error('App state not initialized');

  const colors = {
    Elective: '#1f4e79',
    Emergency: '#2a6f97',
    Urgent: '#4a8ab3'
  };

  function calculateBoxStats(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const n = sorted.length;
    const q1 = sorted[Math.floor(n * 0.25)];
    const median = sorted[Math.floor(n * 0.5)];
    const q3 = sorted[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const min = Math.max(sorted[0], q1 - 1.5 * iqr);
    const max = Math.min(sorted[n - 1], q3 + 1.5 * iqr);
    const outliers = sorted.filter(v => v < min || v > max);
    return { min, q1, median, q3, max, outliers, mean: d3.mean(sorted) };
  }

  function buildData(rows) {
    const byAdmission = d3.group(rows, d => d.admissionType || 'Unknown');
    const data = [];
    
    for (const [admission, records] of byAdmission) {
      const losValues = records
        .map(r => r.lengthOfStayDays)
        .filter(v => v != null && !isNaN(v) && v >= 0);
      
      if (losValues.length > 4) {
        const stats = calculateBoxStats(losValues);
        if (stats) {
          data.push({ admission, ...stats, count: losValues.length });
        }
      }
    }
    
    return data.sort((a, b) => b.median - a.median);
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('g').attr('class', 'grid');
    svg.append('g').attr('class', 'plot');
    svg.append('g').attr('class', 'x-axis');
    svg.append('g').attr('class', 'y-axis');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Length of Stay by Admission Type');

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

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-boxplot');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;
    const margin = { top: 32, right: 20, bottom: 50, left: 60 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const data = buildData(rows);

    if (!data.length) {
      svg.select('.plot').selectAll('*').remove();
      svg.select('.plot')
        .append('text')
        .attr('x', w / 2)
        .attr('y', h / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .text('No data available');
      return;
    }

    const x = d3.scaleBand()
      .domain(data.map(d => d.admission))
      .range([margin.left, w - margin.right])
      .padding(0.3);

    const maxY = d3.max(data, d => d.max) || 30;
    const y = d3.scaleLinear()
      .domain([0, maxY * 1.1])
      .nice()
      .range([h - margin.bottom, margin.top]);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('font-size', 11);

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).ticks(6));

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

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 8)
      .text('Admission Type');

    svg.select('.y-label')
      .attr('x', -(margin.top + h - margin.bottom) / 2)
      .attr('y', 16)
      .text('Length of Stay (days)');

    const g = svg.select('.plot');

    // Box groups
    const boxes = g.selectAll('.box-group')
      .data(data, d => d.admission);

    boxes.exit().remove();

    const boxEnter = boxes.enter()
      .append('g')
      .attr('class', 'box-group');

    // Whisker line (min to max)
    boxEnter.append('line').attr('class', 'whisker');
    // Box rect
    boxEnter.append('rect').attr('class', 'box');
    // Median line
    boxEnter.append('line').attr('class', 'median-line');
    // Min cap
    boxEnter.append('line').attr('class', 'min-cap');
    // Max cap
    boxEnter.append('line').attr('class', 'max-cap');

    const boxMerge = boxEnter.merge(boxes);
    const boxWidth = x.bandwidth();

    boxMerge.select('.whisker')
      .transition().duration(400)
      .attr('x1', d => x(d.admission) + boxWidth / 2)
      .attr('x2', d => x(d.admission) + boxWidth / 2)
      .attr('y1', d => y(d.min))
      .attr('y2', d => y(d.max))
      .attr('stroke', '#374151')
      .attr('stroke-width', 1);

    boxMerge.select('.box')
      .transition().duration(400)
      .attr('x', d => x(d.admission))
      .attr('y', d => y(d.q3))
      .attr('width', boxWidth)
      .attr('height', d => Math.max(0, y(d.q1) - y(d.q3)))
      .attr('fill', d => colors[d.admission] || '#1f4e79')
      .attr('stroke', '#374151')
      .attr('stroke-width', 1)
      .attr('rx', 3)
      .attr('opacity', 0.85);

    boxMerge.select('.median-line')
      .transition().duration(400)
      .attr('x1', d => x(d.admission))
      .attr('x2', d => x(d.admission) + boxWidth)
      .attr('y1', d => y(d.median))
      .attr('y2', d => y(d.median))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    const capWidth = boxWidth * 0.4;
    boxMerge.select('.min-cap')
      .transition().duration(400)
      .attr('x1', d => x(d.admission) + boxWidth / 2 - capWidth / 2)
      .attr('x2', d => x(d.admission) + boxWidth / 2 + capWidth / 2)
      .attr('y1', d => y(d.min))
      .attr('y2', d => y(d.min))
      .attr('stroke', '#374151')
      .attr('stroke-width', 1);

    boxMerge.select('.max-cap')
      .transition().duration(400)
      .attr('x1', d => x(d.admission) + boxWidth / 2 - capWidth / 2)
      .attr('x2', d => x(d.admission) + boxWidth / 2 + capWidth / 2)
      .attr('y1', d => y(d.max))
      .attr('y2', d => y(d.max))
      .attr('stroke', '#374151')
      .attr('stroke-width', 1);

    // Tooltip interaction
    boxMerge.select('.box')
      .style('cursor', 'pointer')
      .on('mousemove', (event, d) => {
        tooltip.show(
          `<div style="font-weight:600;">${d.admission}</div>
          <div>Patients: ${d.count.toLocaleString()}</div>
          <div>Min: ${d.min.toFixed(1)} days</div>
          <div>Q1: ${d.q1.toFixed(1)} days</div>
          <div>Median: ${d.median.toFixed(1)} days</div>
          <div>Q3: ${d.q3.toFixed(1)} days</div>
          <div>Max: ${d.max.toFixed(1)} days</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', () => tooltip.hide());
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.boxPlot = { init, update };
})();
