(function () {
  if (!window.App) throw new Error('App state not initialized');

  function buildGraph(rows, topNConditions = 12) {
    const orderResults = ['Normal', 'Abnormal', 'Inconclusive'];

    // Keep the sankey readable by limiting conditions.
    const conditionCounts = d3.rollups(
      rows,
      v => v.length,
      d => d.medicalCondition || 'Unknown'
    );
    conditionCounts.sort((a, b) => d3.descending(a[1], b[1]));
    const allowedConditions = new Set(conditionCounts.slice(0, topNConditions).map(d => d[0]));

    const links = new Map();

    function inc(source, target) {
      const key = `${source}__${target}`;
      links.set(key, (links.get(key) || 0) + 1);
    }

    for (const r of rows) {
      const admission = r.admissionType || 'Unknown';
      const condition = (r.medicalCondition && allowedConditions.has(r.medicalCondition)) ? r.medicalCondition : 'Other conditions';
      const result = orderResults.includes(r.testResult) ? r.testResult : 'Inconclusive';

      inc(`Admission: ${admission}`, `Condition: ${condition}`);
      inc(`Condition: ${condition}`, `Result: ${result}`);
    }

    const nodesSet = new Set();
    const linkList = [];
    for (const [k, value] of links.entries()) {
      const [source, target] = k.split('__');
      nodesSet.add(source);
      nodesSet.add(target);
      linkList.push({ source, target, value });
    }

    const nodes = Array.from(nodesSet).map(name => ({ name }));
    const index = new Map(nodes.map((n, i) => [n.name, i]));
    const sankeyLinks = linkList.map(l => ({
      source: index.get(l.source),
      target: index.get(l.target),
      value: l.value
    }));

    return { nodes, links: sankeyLinks };
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('g').attr('class', 'plot');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-sankey');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const g = svg.select('.plot');

    // Handle empty data gracefully
    if (!rows || rows.length === 0) {
      g.selectAll('*').remove();
      g.append('text')
        .attr('x', (root.clientWidth || 920) / 2)
        .attr('y', (root.clientHeight || 320) / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .attr('font-size', 14)
        .text('No data available');
      return;
    }

    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 920;
    const h = root.clientHeight || 320;
    const margin = { top: 12, right: 10, bottom: 12, left: 10 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const g = svg.select('.plot');
    g.attr('transform', `translate(${margin.left},${margin.top})`);

    const innerW = w - margin.left - margin.right;
    const innerH = h - margin.top - margin.bottom;

    const graph = buildGraph(rows, 12);

    // Guard against empty graph
    if (!graph.nodes.length || !graph.links.length) {
      g.selectAll('*').remove();
      g.append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6b7280')
        .attr('font-size', 14)
        .text('Insufficient data for flow diagram');
      return;
    }

    const sankey = d3.sankey()
      .nodeWidth(14)
      .nodePadding(10)
      .extent([[0, 0], [innerW, innerH]]);

    const { nodes, links } = sankey({
      nodes: graph.nodes.map(d => ({ ...d })),
      links: graph.links.map(d => ({ ...d }))
    });

    const nodeColor = (d) => {
      if (d.name.startsWith('Admission:')) return '#1f4e79';
      if (d.name.startsWith('Condition:')) return '#2a6f97';
      return '#6b7280';
    };

    // Links
    const linkSel = g.selectAll('path.sankey-link')
      .data(links, d => `${d.source.name}__${d.target.name}`);

    linkSel.enter()
      .append('path')
      .attr('class', 'sankey-link')
      .attr('fill', 'none')
      .attr('stroke', 'rgba(31, 78, 121, 0.25)')
      .attr('stroke-width', d => Math.max(1, d.width))
      .attr('d', d3.sankeyLinkHorizontal())
      .style('mix-blend-mode', 'multiply')
      .on('mouseenter', function () {
        d3.select(this).attr('stroke', 'rgba(31, 78, 121, 0.55)');
      })
      .on('mousemove', (event, d) => {
        tooltip.show(
          `<div style="font-weight:600;">Flow</div>` +
          `<div>${d.source.name.replace(/^.*?:\s/, '')} → ${d.target.name.replace(/^.*?:\s/, '')}</div>` +
          `<div>${d.value.toLocaleString()} patients</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function () {
        d3.select(this).attr('stroke', 'rgba(31, 78, 121, 0.25)');
        tooltip.hide();
      })
      .merge(linkSel)
      .transition()
      .duration(250)
      .attr('stroke-width', d => Math.max(1, d.width))
      .attr('d', d3.sankeyLinkHorizontal());

    linkSel.exit().remove();

    // Nodes
    const nodeSel = g.selectAll('g.sankey-node')
      .data(nodes, d => d.name);

    const nodeEnter = nodeSel.enter().append('g').attr('class', 'sankey-node');
    nodeEnter.append('rect')
      .attr('rx', 3)
      .attr('stroke', 'rgba(17, 24, 39, 0.25)')
      .attr('stroke-width', 1);

    nodeEnter.append('text')
      .attr('font-size', 11)
      .attr('fill', '#111827')
      .attr('dy', '0.35em');

    const nodeMerged = nodeEnter.merge(nodeSel);

    nodeMerged.select('rect')
      .attr('x', d => d.x0)
      .attr('y', d => d.y0)
      .attr('height', d => Math.max(1, d.y1 - d.y0))
      .attr('width', d => Math.max(1, d.x1 - d.x0))
      .attr('fill', d => nodeColor(d))
      .attr('opacity', 0.85);

    nodeMerged.select('text')
      .attr('x', d => (d.x0 < innerW / 2) ? (d.x1 + 6) : (d.x0 - 6))
      .attr('y', d => (d.y0 + d.y1) / 2)
      .attr('text-anchor', d => (d.x0 < innerW / 2) ? 'start' : 'end')
      .text(d => d.name.replace(/^.*?:\s/, ''))
      .style('pointer-events', 'none');

    nodeMerged
      .on('mouseenter', function () {
        d3.select(this).select('rect').attr('opacity', 1);
      })
      .on('mousemove', (event, d) => {
        tooltip.show(
          `<div style="font-weight:600;">${d.name.replace(/^.*?:\s/, '')}</div>` +
          `<div>${d.value.toLocaleString()} patients</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function () {
        d3.select(this).select('rect').attr('opacity', 0.85);
        tooltip.hide();
      });

    nodeSel.exit().remove();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.patientFlow = { init, update };
})();
