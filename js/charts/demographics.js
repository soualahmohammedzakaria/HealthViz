(function () {
  if (!window.App) throw new Error('App state not initialized');

  const ageGroups = ['0–18', '19–40', '41–65', '65+'];

  function build(rows) {
    const genders = Array.from(new Set(rows.map(d => d.gender).filter(Boolean))).sort();
    const usedGenders = genders.length ? genders : ['Male', 'Female'];

    const data = ageGroups.map(g => {
      const obj = { ageGroup: g };
      for (const sex of usedGenders) obj[sex] = 0;
      obj.total = 0;
      return obj;
    });

    const idx = new Map(ageGroups.map((g, i) => [g, i]));
    for (const r of rows) {
      if (!r.ageGroup || !idx.has(r.ageGroup) || !r.gender) continue;
      const i = idx.get(r.ageGroup);
      data[i][r.gender] = (data[i][r.gender] || 0) + 1;
      data[i].total += 1;
    }

    return { data, genders: usedGenders };
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
      .text('Demographics: Age Group × Gender');

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
    const root = document.getElementById('chart-demographics');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 520;
    const h = root.clientHeight || 320;
    const margin = { top: 28, right: 10, bottom: 36, left: 60 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const { data, genders } = build(rows);

    const x = d3.scaleBand()
      .domain(ageGroups)
      .range([margin.left, w - margin.right])
      .padding(0.25);

    const maxY = d3.max(data, d => d.total) || 1;
    const y = d3.scaleLinear()
      .domain([0, maxY])
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
      .text('Age group');

    svg.select('.y-label')
      .attr('x', -((margin.top + h - margin.bottom) / 2))
      .attr('y', 12)
      .text('Patient count');

    const color = d3.scaleOrdinal()
      .domain(genders)
      .range(['#1f4e79', '#8f8f8f', '#2a6f97', '#b23a48']);

    const stack = d3.stack().keys(genders);
    const series = stack(data);

    const layer = svg.select('.plot')
      .selectAll('g.layer')
      .data(series, d => d.key);

    const layerEnter = layer.enter().append('g').attr('class', 'layer');
    layerEnter.merge(layer)
      .attr('fill', d => color(d.key));

    layer.exit().remove();

    const rects = svg.selectAll('g.layer')
      .selectAll('rect')
      .data(d => d.map(v => ({ key: d.key, v })), d => `${d.key}-${d.v.data.ageGroup}`);

    rects.enter()
      .append('rect')
      .attr('x', d => x(d.v.data.ageGroup))
      .attr('width', x.bandwidth())
      .attr('y', y(0))
      .attr('height', 0)
      .attr('rx', 4)
      .style('cursor', 'default')
      .on('mousemove', (event, d) => {
        const val = d.v[1] - d.v[0];
        tooltip.show(
          `<div style="font-weight:600;">${d.v.data.ageGroup} · ${d.key}</div>` +
          `<div>${val.toLocaleString()} patients</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', () => tooltip.hide())
      .merge(rects)
      .transition()
      .duration(250)
      .attr('x', d => x(d.v.data.ageGroup))
      .attr('width', x.bandwidth())
      .attr('y', d => y(d.v[1]))
      .attr('height', d => Math.max(0, y(d.v[0]) - y(d.v[1])));

    rects.exit().remove();

    // light legend (top-right)
    const legend = svg.selectAll('g.legend').data([0]);
    const legendEnter = legend.enter().append('g').attr('class', 'legend');
    legendEnter.merge(legend)
      .attr('transform', `translate(${w - margin.right - 140}, ${8})`);

    const li = svg.select('g.legend').selectAll('g').data(genders);
    const liEnter = li.enter().append('g');
    liEnter.append('rect').attr('width', 10).attr('height', 10).attr('rx', 2);
    liEnter.append('text').attr('x', 14).attr('y', 9).attr('font-size', 11).attr('fill', '#374151');

    liEnter.merge(li)
      .attr('transform', (d, i) => `translate(${i * 70}, 0)`);
    liEnter.merge(li).select('rect').attr('fill', d => color(d));
    liEnter.merge(li).select('text').text(d => d);
    li.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.demographics = { init, update };
})();
