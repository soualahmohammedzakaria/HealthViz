(function () {
  if (!window.App) throw new Error('App state not initialized');

  const order = ['Normal', 'Abnormal', 'Inconclusive'];

  function buildHeatmap(rows, topN = 12) {
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

    const conditions = byCond.slice(0, topN).map(d => d[0]);

    const conditionToCounts = new Map(byCond.map(([c, map]) => [c, map]));
    const cells = [];
    for (const c of conditions) {
      const counts = conditionToCounts.get(c) || new Map();
      for (const tr of order) {
        cells.push({ condition: c, testResult: tr, value: counts.get(tr) || 0 });
      }
    }

    return { conditions, cells };
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
      .text('Medical Conditions vs Test Results');

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
    const margin = { top: 28, right: 10, bottom: 44, left: 100 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const { conditions, cells } = buildHeatmap(rows, 12);

    const x = d3.scaleBand()
      .domain(order)
      .range([margin.left, w - margin.right])
      .padding(0.08);

    const y = d3.scaleBand()
      .domain(conditions)
      .range([margin.top + 10, h - margin.bottom])
      .padding(0.12);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${margin.top + 10})`)
      .call(d3.axisTop(x));

    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y).tickSizeOuter(0));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 6)
      .text('Test Results');

    svg.select('.y-label')
      .attr('x', -((margin.top + 10 + h - margin.bottom) / 2))
      .attr('y', 10)
      .text('Medical conditions (top)');

    const maxVal = d3.max(cells, d => d.value) || 1;
    const color = d3.scaleSequential(d3.interpolateBlues).domain([0, maxVal]);

    // small legend: 0 → max
    legend.attr('transform', `translate(${w - margin.right - 160}, ${8})`);
    const legendData = [0, Math.round(maxVal / 2), maxVal];
    const legendItem = legend.selectAll('g').data(legendData);
    const legendEnter = legendItem.enter().append('g');
    legendEnter.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2);
    legendEnter.append('text').attr('x', 14).attr('y', 9).attr('font-size', 11).attr('fill', '#374151');
    legendEnter.merge(legendItem).attr('transform', (d, i) => `translate(${i * 52}, 0)`);
    legendEnter.merge(legendItem).select('rect').attr('fill', d => color(d));
    legendEnter.merge(legendItem).select('text').text(d => d.toLocaleString());
    legendItem.exit().remove();

    const rects = svg.select('.plot')
      .selectAll('rect.heatmap-cell')
      .data(cells, d => `${d.condition}__${d.testResult}`);

    rects.enter()
      .append('rect')
      .attr('class', 'heatmap-cell')
      .attr('x', d => x(d.testResult))
      .attr('y', d => y(d.condition))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('rx', 6)
      .attr('fill', d => color(d.value))
      .attr('stroke', 'rgba(17, 24, 39, 0.0)')
      .attr('stroke-width', 1.5)
      .style('cursor', 'default')
      .on('mouseenter', function () {
        d3.select(this).attr('stroke', 'rgba(17, 24, 39, 0.65)');
      })
      .on('mousemove', (event, d) => {
        tooltip.show(
          `<div style="font-weight:600;">${d.condition}</div>` +
          `<div>${d.testResult}: ${d.value.toLocaleString()} patients</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke', 'rgba(17, 24, 39, 0.0)');
        tooltip.hide();
      })
      .merge(rects)
      .transition()
      .duration(250)
      .attr('x', d => x(d.testResult))
      .attr('y', d => y(d.condition))
      .attr('width', x.bandwidth())
      .attr('height', y.bandwidth())
      .attr('fill', d => color(d.value));

    rects.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.conditions = { init, update };
})();
