(function () {
  if (!window.App) throw new Error('App state not initialized');

  const colorScale = d3.scaleOrdinal()
    .range(['#1f4e79', '#2a6f97', '#4a8ab3', '#b23a48', '#d05661', '#10b981', '#f59e0b', '#8b5cf6']);

  function buildHierarchy(rows) {
    const byCondition = d3.group(rows, d => d.medicalCondition || 'Unknown');
    
    const children = [];
    for (const [condition, records] of byCondition) {
      const byMedication = d3.rollup(
        records,
        v => v.length,
        d => d.medication || 'Unknown'
      );

      const medChildren = Array.from(byMedication, ([medication, count]) => ({
        name: medication,
        value: count,
        condition: condition
      }));

      children.push({
        name: condition,
        children: medChildren
      });
    }

    return {
      name: 'Healthcare',
      children: children.sort((a, b) => 
        d3.sum(b.children, c => c.value) - d3.sum(a.children, c => c.value)
      )
    };
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
      .text('Condition → Medication Breakdown (Treemap)');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-treemap');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 680;
    const h = root.clientHeight || 320;
    const margin = { top: 28, right: 10, bottom: 10, left: 10 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const hierarchy = buildHierarchy(rows);

    if (!hierarchy.children.length) {
      svg.select('.plot').selectAll('*').remove();
      return;
    }

    const rootNode = d3.hierarchy(hierarchy)
      .sum(d => d.value || 0)
      .sort((a, b) => b.value - a.value);

    d3.treemap()
      .size([w - margin.left - margin.right, h - margin.top - margin.bottom])
      .paddingOuter(3)
      .paddingTop(19)
      .paddingInner(2)
      .round(true)(rootNode);

    const g = svg.select('.plot')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    g.selectAll('*').remove();

    // Condition groups
    const conditions = g.selectAll('g.condition')
      .data(rootNode.children || [])
      .enter()
      .append('g')
      .attr('class', 'condition')
      .attr('transform', d => `translate(${d.x0},${d.y0})`);

    // Condition background
    conditions.append('rect')
      .attr('width', d => d.x1 - d.x0)
      .attr('height', d => d.y1 - d.y0)
      .attr('fill', (d, i) => d3.color(colorScale(i)).brighter(0.7))
      .attr('stroke', (d, i) => colorScale(i))
      .attr('stroke-width', 1)
      .attr('rx', 4);

    // Condition label
    conditions.append('text')
      .attr('x', 4)
      .attr('y', 13)
      .attr('font-size', 10)
      .attr('font-weight', 600)
      .attr('fill', '#1f2937')
      .text(d => {
        const availWidth = d.x1 - d.x0 - 8;
        const name = d.data.name;
        if (availWidth < 50) return '';
        if (name.length * 6 > availWidth) return name.slice(0, Math.floor(availWidth / 6)) + '…';
        return name;
      });

    // Medication leaves
    const leaves = conditions.selectAll('rect.leaf')
      .data(d => d.children || [])
      .enter()
      .append('rect')
      .attr('class', 'leaf')
      .attr('x', d => d.x0 - d.parent.x0)
      .attr('y', d => d.y0 - d.parent.y0)
      .attr('width', d => Math.max(0, d.x1 - d.x0))
      .attr('height', d => Math.max(0, d.y1 - d.y0))
      .attr('fill', function(d) {
        const parentIndex = d.parent ? rootNode.children.indexOf(d.parent) : 0;
        return colorScale(parentIndex);
      })
      .attr('rx', 2)
      .attr('opacity', 0.85)
      .style('cursor', 'pointer')
      .on('mouseenter', function() {
        d3.select(this).attr('opacity', 1);
      })
      .on('mousemove', (event, d) => {
        const total = rootNode.value;
        const pct = ((d.value / total) * 100).toFixed(1);
        tooltip.show(
          `<div style="font-weight:600;">${d.data.name}</div>
          <div>Condition: ${d.data.condition}</div>
          <div>Patients: ${d.value.toLocaleString()}</div>
          <div>Share: ${pct}%</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function() {
        d3.select(this).attr('opacity', 0.85);
        tooltip.hide();
      });

    // Leaf labels
    conditions.selectAll('text.leaf-label')
      .data(d => d.children || [])
      .enter()
      .append('text')
      .attr('class', 'leaf-label')
      .attr('x', d => d.x0 - d.parent.x0 + 3)
      .attr('y', d => d.y0 - d.parent.y0 + 12)
      .attr('font-size', 9)
      .attr('fill', '#fff')
      .attr('pointer-events', 'none')
      .text(d => {
        const boxW = d.x1 - d.x0;
        const boxH = d.y1 - d.y0;
        if (boxW < 40 || boxH < 18) return '';
        const name = d.data.name;
        if (name.length * 5 > boxW - 6) return name.slice(0, Math.floor((boxW - 6) / 5)) + '…';
        return name;
      });
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.treemap = { init, update };
})();
