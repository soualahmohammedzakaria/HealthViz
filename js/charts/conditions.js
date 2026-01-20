(function () {
  if (!window.App) throw new Error('App state not initialized');

  const order = ['Normal', 'Abnormal', 'Inconclusive'];
  const colors = {
    'Normal': '#1f4e79',
    'Abnormal': '#b23a48',
    'Inconclusive': '#6b7280'
  };

  function buildData(rows, topN = 8) {
    const byCond = d3.rollups(
      rows,
      v => {
        const counts = new Map(order.map(k => [k, 0]));
        for (const r of v) counts.set(r.testResult, (counts.get(r.testResult) || 0) + 1);
        return counts;
      },
      d => d.medicalCondition || 'Unknown'
    );

    byCond.sort((a, b) => {
      const ta = d3.sum(order, k => a[1].get(k) || 0);
      const tb = d3.sum(order, k => b[1].get(k) || 0);
      return d3.descending(ta, tb);
    });

    const data = byCond.slice(0, topN).map(([condition, counts]) => {
      const obj = { condition };
      let total = 0;
      for (const k of order) {
        obj[k] = counts.get(k) || 0;
        total += obj[k];
      }
      obj.total = total;
      return obj;
    });

    return data;
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
      .text('Conditions by Test Result');

    svg.append('text')
      .attr('class', 'x-label')
      .attr('text-anchor', 'middle')
      .attr('font-size', 11)
      .attr('fill', '#6b7280');

    // Legend
    const legend = svg.append('g').attr('class', 'legend');
    root.__chart = { svg, legend };
  }

  function update(rows) {
    const root = document.getElementById('chart-conditions');
    if (!root || !root.__chart) return;

    const { svg, legend } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;
    const margin = { top: 28, right: 20, bottom: 36, left: 110 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const data = buildData(rows, 8);

    const maxTotal = d3.max(data, d => d.total) || 1;

    const y = d3.scaleBand()
      .domain(data.map(d => d.condition))
      .range([margin.top + 10, h - margin.bottom])
      .padding(0.2);

    const x = d3.scaleLinear()
      .domain([0, maxTotal])
      .nice()
      .range([margin.left, w - margin.right]);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSizeOuter(0));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 6)
      .text('Patient Count');

    // Build stacked data
    const stack = d3.stack().keys(order);
    const series = stack(data);

    const plotG = svg.select('.plot');

    // Bind series (layers)
    const layers = plotG.selectAll('g.layer')
      .data(series, d => d.key);

    const layersEnter = layers.enter()
      .append('g')
      .attr('class', 'layer')
      .attr('fill', d => colors[d.key]);

    layers.exit().remove();

    const allLayers = layersEnter.merge(layers);

    // Bind rects within each layer
    allLayers.each(function(seriesData) {
      const layer = d3.select(this);
      const key = seriesData.key;

      const rects = layer.selectAll('rect')
        .data(seriesData, d => d.data.condition);

      rects.enter()
        .append('rect')
        .attr('y', d => y(d.data.condition))
        .attr('height', y.bandwidth())
        .attr('x', margin.left)
        .attr('width', 0)
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('mouseenter', function() {
          d3.select(this).attr('opacity', 0.8);
        })
        .on('mousemove', function(event, d) {
          const val = d[1] - d[0];
          const pct = ((val / d.data.total) * 100).toFixed(1);
          tooltip.show(
            `<div style="font-weight:600;">${d.data.condition}</div>` +
            `<div>${key}: ${val.toLocaleString()} (${pct}%)</div>` +
            `<div style="color:#6b7280;">Total: ${d.data.total.toLocaleString()}</div>`,
            event.clientX, event.clientY
          );
        })
        .on('mouseleave', function() {
          d3.select(this).attr('opacity', 1);
          tooltip.hide();
        })
        .merge(rects)
        .transition()
        .duration(300)
        .attr('y', d => y(d.data.condition))
        .attr('height', y.bandwidth())
        .attr('x', d => x(d[0]))
        .attr('width', d => Math.max(0, x(d[1]) - x(d[0])));

      rects.exit().remove();
    });

    // Legend
    legend.attr('transform', `translate(${w - margin.right - 200}, ${6})`);
    
    const legendItems = legend.selectAll('g.legend-item')
      .data(order, d => d);

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
      .attr('transform', (d, i) => `translate(${i * 68}, 0)`)
      .select('rect')
      .attr('fill', d => colors[d]);

    legendEnter.merge(legendItems)
      .select('text')
      .text(d => d);

    legendItems.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.conditions = { init, update };
})();
