(function () {
  if (!window.App) throw new Error('App state not initialized');

  function quantile(sorted, p) {
    if (!sorted.length) return null;
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    const w = idx - lo;
    return sorted[lo] * (1 - w) + sorted[hi] * w;
  }

  function mean(values) {
    if (!values.length) return null;
    let sum = 0;
    for (const v of values) sum += v;
    return sum / values.length;
  }

  function std(values, mu) {
    if (!values.length) return null;
    let sumSq = 0;
    for (const v of values) {
      const d = v - mu;
      sumSq += d * d;
    }
    return Math.sqrt(sumSq / values.length);
  }

  function gaussianKernel(u) {
    return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
  }

  function estimateBandwidth(values) {
    if (values.length < 2) return 1;
    const mu = mean(values);
    const s = std(values, mu) || 1;
    // Silverman's rule of thumb
    const h = 1.06 * s * Math.pow(values.length, -0.2);
    return (Number.isFinite(h) && h > 0) ? h : 1;
  }

  function kde(values, yTicks, bandwidth) {
    const n = values.length;
    if (!n) return yTicks.map(y => [y, 0]);
    const inv = 1 / (n * bandwidth);
    return yTicks.map(y => {
      let sum = 0;
      for (const v of values) sum += gaussianKernel((y - v) / bandwidth);
      return [y, sum * inv];
    });
  }

  function densityAt(densityPoints, y) {
    if (!densityPoints.length) return 0;
    if (y <= densityPoints[0][0]) return densityPoints[0][1];
    if (y >= densityPoints[densityPoints.length - 1][0]) return densityPoints[densityPoints.length - 1][1];
    for (let i = 1; i < densityPoints.length; i++) {
      const [y0, d0] = densityPoints[i - 1];
      const [y1, d1] = densityPoints[i];
      if (y <= y1) {
        const t = (y - y0) / (y1 - y0 || 1);
        return d0 + (d1 - d0) * t;
      }
    }
    return densityPoints[densityPoints.length - 1][1];
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

    svg.append('g').attr('class', 'overlay');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Billing Amount (Violin Plot)');

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
    const root = document.getElementById('chart-billing');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip, format } = window.App.utils;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;
    const margin = { top: 28, right: 12, bottom: 36, left: 52 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const values = rows.map(d => d.billingAmount).filter(v => v != null && !Number.isNaN(v));
    const sorted = values.slice().sort((a, b) => a - b);

    const yDomain = d3.extent(sorted);
    const y = d3.scaleLinear()
      .domain(yDomain[0] == null ? [0, 1] : yDomain)
      .nice()
      .range([h - margin.bottom, margin.top + 10]);

    const xCenter = (margin.left + w - margin.right) / 2;
    const x = d3.scaleLinear()
      .domain([-1, 1])
      .range([xCenter - 140, xCenter + 140]);

    svg.select('.x-axis')
      .attr('transform', `translate(0,${h - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(0));

    svg.select('.y-axis')
      .attr('transform', `translate(${xCenter},0)`)
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => {
        return '$' + (Math.round(d / 1000)).toString() + 'k';
      }));

    svg.select('.x-label')
      .attr('x', (margin.left + w - margin.right) / 2)
      .attr('y', h - 6)
      .text('Density (mirrored)');

    svg.select('.y-label')
      .attr('x', -((margin.top + 10 + h - margin.bottom) / 2))
      .attr('y', 16)
      .text('Billing amount (USD)');

    const stats = {
      n: sorted.length,
      min: sorted.length ? sorted[0] : null,
      max: sorted.length ? sorted[sorted.length - 1] : null,
      q1: quantile(sorted, 0.25),
      median: quantile(sorted, 0.5),
      q3: quantile(sorted, 0.75)
    };

    const yTicks = y.ticks(60);
    const bandwidth = estimateBandwidth(sorted);
    const density = kde(sorted, yTicks, bandwidth);
    const maxDensity = d3.max(density, d => d[1]) || 1;
    const widthScale = d3.scaleLinear().domain([0, maxDensity]).range([0, 0.9]);

    const area = d3.area()
      .x0(d => x(-widthScale(d[1])))
      .x1(d => x(widthScale(d[1])))
      .y(d => y(d[0]))
      .curve(d3.curveCatmullRom);

    const plot = svg.select('.plot');

    const violin = plot.selectAll('path.violin').data([density]);
    violin.enter()
      .append('path')
      .attr('class', 'violin')
      .attr('fill', '#2a6f97')
      .attr('opacity', 0.75)
      .attr('stroke', 'rgba(17, 24, 39, 0.25)')
      .attr('stroke-width', 1)
      .merge(violin)
      .transition()
      .duration(250)
      .attr('d', area);
    violin.exit().remove();

    // Box/median overlay
    const boxWidth = 20;
    const box = plot.selectAll('rect.box').data(stats.median != null ? [stats] : []);
    box.enter()
      .append('rect')
      .attr('class', 'box')
      .attr('x', xCenter - boxWidth / 2)
      .attr('width', boxWidth)
      .attr('rx', 4)
      .attr('fill', 'rgba(255,255,255,0.65)')
      .attr('stroke', 'rgba(17, 24, 39, 0.35)')
      .merge(box)
      .transition()
      .duration(250)
      .attr('x', xCenter - boxWidth / 2)
      .attr('width', boxWidth)
      .attr('y', d => y(d.q3))
      .attr('height', d => Math.max(0, y(d.q1) - y(d.q3)));
    box.exit().remove();

    const medianLine = plot.selectAll('line.median').data(stats.median != null ? [stats.median] : []);
    medianLine.enter()
      .append('line')
      .attr('class', 'median')
      .attr('stroke', 'rgba(17, 24, 39, 0.85)')
      .attr('stroke-width', 2)
      .merge(medianLine)
      .transition()
      .duration(250)
      .attr('x1', xCenter - boxWidth / 2)
      .attr('x2', xCenter + boxWidth / 2)
      .attr('y1', d => y(d))
      .attr('y2', d => y(d));
    medianLine.exit().remove();

    // Hover overlay (stats + density at hovered value)
    const overlay = svg.select('.overlay');
    const rect = overlay.selectAll('rect').data([0]);
    rect.enter()
      .append('rect')
      .attr('fill', 'transparent')
      .style('cursor', 'default')
      .merge(rect)
      .attr('x', margin.left)
      .attr('y', margin.top + 10)
      .attr('width', (w - margin.right) - margin.left)
      .attr('height', (h - margin.bottom) - (margin.top + 10))
      .on('mousemove', (event) => {
        if (!stats.n) return;
        const [mx, my] = d3.pointer(event);
        const val = y.invert(my);
        const dAt = densityAt(density, val);
        tooltip.show(
          `<div style="font-weight:600;">Billing Amount</div>` +
          `<div>n = ${stats.n.toLocaleString()}</div>` +
          `<div>Median: ${format.formatMoney(stats.median)}</div>` +
          `<div>Range: ${format.formatMoney(stats.min)} – ${format.formatMoney(stats.max)}</div>` +
          `<div>Density @ ${format.formatMoney(val)}: ${format.formatNumber(dAt)}</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', () => tooltip.hide());
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.billing = { init, update };
})();
