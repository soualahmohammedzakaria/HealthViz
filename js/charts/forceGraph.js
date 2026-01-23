(function () {
  if (!window.App) throw new Error('App state not initialized');

  const nodeColors = {
    condition: '#1f4e79',
    medication: '#2a6f97',
    admission: '#4a8ab3'
  };

  function buildGraph(rows) {
    const nodes = [];
    const links = [];
    const nodeMap = new Map();
    const linkMap = new Map();

    // Get unique conditions and medications
    const conditions = new Set();
    const medications = new Set();
    const conditionMedCount = new Map();

    for (const r of rows) {
      const cond = r.medicalCondition || 'Unknown';
      const med = r.medication || 'Unknown';
      
      conditions.add(cond);
      medications.add(med);
      
      const linkKey = `${cond}__${med}`;
      conditionMedCount.set(linkKey, (conditionMedCount.get(linkKey) || 0) + 1);
    }

    // Create condition nodes
    let nodeId = 0;
    for (const cond of conditions) {
      const count = rows.filter(r => r.medicalCondition === cond).length;
      nodes.push({
        id: nodeId,
        name: cond,
        type: 'condition',
        count: count,
        radius: Math.max(5, Math.min(16, Math.sqrt(count) * 0.9))
      });
      nodeMap.set(`cond_${cond}`, nodeId);
      nodeId++;
    }

    // Create medication nodes
    for (const med of medications) {
      const count = rows.filter(r => r.medication === med).length;
      nodes.push({
        id: nodeId,
        name: med,
        type: 'medication',
        count: count,
        radius: Math.max(4, Math.min(14, Math.sqrt(count) * 0.8))
      });
      nodeMap.set(`med_${med}`, nodeId);
      nodeId++;
    }

    // Create links between conditions and medications
    for (const [key, count] of conditionMedCount) {
      const [cond, med] = key.split('__');
      const sourceId = nodeMap.get(`cond_${cond}`);
      const targetId = nodeMap.get(`med_${med}`);
      
      if (sourceId !== undefined && targetId !== undefined && count > 10) {
        links.push({
          source: sourceId,
          target: targetId,
          value: count,
          width: Math.max(1, Math.min(6, Math.sqrt(count) * 0.3))
        });
      }
    }

    return { nodes, links };
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('defs');
    svg.append('g').attr('class', 'links');
    svg.append('g').attr('class', 'nodes');
    svg.append('g').attr('class', 'labels');
    svg.append('g').attr('class', 'legend');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Condition-Medication Network (Force Graph)');

    root.__chart = { svg, simulation: null };
  }

  function update(rows) {
    const root = document.getElementById('chart-force-graph');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 920;
    const h = root.clientHeight || 360;

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const { nodes, links } = buildGraph(rows);

    if (!nodes.length) {
      svg.select('.nodes').selectAll('*').remove();
      svg.select('.links').selectAll('*').remove();
      svg.select('.labels').selectAll('*').remove();
      return;
    }

    // Stop previous simulation
    if (root.__chart.simulation) {
      root.__chart.simulation.stop();
    }

    // Create force simulation
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(60).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-80))
      .force('center', d3.forceCenter(w / 2, h / 2))
      .force('collision', d3.forceCollide().radius(d => d.radius + 3))
      .force('x', d3.forceX(w / 2).strength(0.05))
      .force('y', d3.forceY(h / 2).strength(0.05));

    root.__chart.simulation = simulation;

    // Links
    const linkG = svg.select('.links');
    linkG.selectAll('*').remove();

    const link = linkG.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', '#cbd5e1')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', d => d.width);

    // Nodes
    const nodeG = svg.select('.nodes');
    nodeG.selectAll('*').remove();

    const node = nodeG.selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', d => d.radius)
      .attr('fill', d => nodeColors[d.type])
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }))
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', d.radius * 1.3);
        
        // Highlight connected links
        link.attr('stroke-opacity', l => 
          (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.2
        ).attr('stroke', l =>
          (l.source.id === d.id || l.target.id === d.id) ? '#1f4e79' : '#cbd5e1'
        );
      })
      .on('mousemove', (event, d) => {
        const typeLabel = d.type === 'condition' ? 'Medical Condition' : 'Medication';
        const connections = links.filter(l => l.source.id === d.id || l.target.id === d.id).length;
        tooltip.show(
          `<div style="font-weight:600;">${d.name}</div>
          <div>Type: ${typeLabel}</div>
          <div>Patients: ${d.count.toLocaleString()}</div>
          <div>Connections: ${connections}</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function(event, d) {
        d3.select(this)
          .transition()
          .duration(150)
          .attr('r', d.radius);
        
        link.attr('stroke-opacity', 0.6).attr('stroke', '#cbd5e1');
        tooltip.hide();
      });

    // Labels for larger nodes
    const labelG = svg.select('.labels');
    labelG.selectAll('*').remove();

    const labels = labelG.selectAll('text')
      .data(nodes.filter(d => d.radius > 10))
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#374151')
      .attr('pointer-events', 'none')
      .text(d => d.name.length > 10 ? d.name.slice(0, 10) + '…' : d.name);

    // Update positions on tick
    simulation.on('tick', () => {
      // Keep nodes within bounds
      nodes.forEach(d => {
        d.x = Math.max(d.radius + 10, Math.min(w - d.radius - 10, d.x));
        d.y = Math.max(d.radius + 30, Math.min(h - d.radius - 10, d.y));
      });

      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y + d.radius + 12);
    });

    // Legend
    const legend = svg.select('.legend')
      .attr('transform', `translate(${w - 110}, 30)`);

    legend.selectAll('*').remove();

    const legendData = [
      { type: 'condition', label: 'Condition' },
      { type: 'medication', label: 'Medication' }
    ];

    legendData.forEach((d, i) => {
      const ly = i * 22;
      legend.append('circle')
        .attr('cx', 8)
        .attr('cy', ly + 8)
        .attr('r', 7)
        .attr('fill', nodeColors[d.type]);

      legend.append('text')
        .attr('x', 22)
        .attr('y', ly + 12)
        .attr('font-size', 11)
        .attr('fill', '#374151')
        .text(d.label);
    });

    // Run simulation for initial layout
    simulation.alpha(1).restart();
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.forceGraph = { init, update };
})();
