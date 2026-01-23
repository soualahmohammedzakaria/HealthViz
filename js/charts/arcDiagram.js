(function () {
  if (!window.App) throw new Error('App state not initialized');

  const colors = {
    'Normal': '#1f4e79',
    'Abnormal': '#b23a48',
    'Inconclusive': '#6b7280'
  };

  function buildData(rows) {
    // Group patients by hospital and test result
    const byHospital = d3.group(rows, d => d.hospital || 'Unknown');
    
    // Get top hospitals by patient count
    const hospitalCounts = Array.from(byHospital, ([hospital, records]) => ({
      hospital,
      count: records.length
    })).sort((a, b) => b.count - a.count);

    const topHospitals = hospitalCounts.slice(0, 12).map(h => h.hospital);
    
    // Create nodes (hospitals on the axis)
    const nodes = topHospitals.map((hospital, i) => ({
      id: i,
      name: hospital,
      count: byHospital.get(hospital).length
    }));

    // Create arcs (connections between hospitals sharing same condition patterns)
    const arcs = [];
    const hospitalConditions = new Map();

    // Get dominant condition for each hospital
    for (const hospital of topHospitals) {
      const records = byHospital.get(hospital);
      const condCounts = d3.rollup(records, v => v.length, d => d.medicalCondition);
      const dominant = Array.from(condCounts).sort((a, b) => b[1] - a[1])[0];
      hospitalConditions.set(hospital, dominant ? dominant[0] : 'Unknown');
    }

    // Connect hospitals with same dominant condition
    for (let i = 0; i < topHospitals.length; i++) {
      for (let j = i + 1; j < topHospitals.length; j++) {
        const h1 = topHospitals[i];
        const h2 = topHospitals[j];
        const cond1 = hospitalConditions.get(h1);
        const cond2 = hospitalConditions.get(h2);
        
        if (cond1 === cond2) {
          // Count shared patients with same condition
          const records1 = byHospital.get(h1).filter(r => r.medicalCondition === cond1);
          const records2 = byHospital.get(h2).filter(r => r.medicalCondition === cond2);
          const strength = Math.min(records1.length, records2.length);
          
          arcs.push({
            source: i,
            target: j,
            condition: cond1,
            strength: strength
          });
        }
      }
    }

    return { nodes, arcs, hospitalConditions };
  }

  function init(root) {
    root.innerHTML = '';

    const svg = d3.select(root)
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%');

    svg.append('g').attr('class', 'arcs');
    svg.append('g').attr('class', 'nodes');
    svg.append('g').attr('class', 'labels');

    svg.append('text')
      .attr('class', 'title')
      .attr('x', 10)
      .attr('y', 16)
      .attr('font-size', 12)
      .attr('font-weight', 600)
      .text('Hospital Condition Similarity (Arc Diagram)');

    root.__chart = { svg };
  }

  function update(rows) {
    const root = document.getElementById('chart-arc');
    if (!root || !root.__chart) return;

    const { svg } = root.__chart;
    const { tooltip } = window.App.utils;

    const w = root.clientWidth || 920;
    const h = root.clientHeight || 320;
    const margin = { top: 40, right: 30, bottom: 60, left: 30 };

    svg.attr('viewBox', `0 0 ${w} ${h}`);

    const { nodes, arcs, hospitalConditions } = buildData(rows);

    if (!nodes.length) {
      svg.select('.nodes').selectAll('*').remove();
      svg.select('.arcs').selectAll('*').remove();
      svg.select('.labels').selectAll('*').remove();
      return;
    }

    const innerW = w - margin.left - margin.right;
    const axisY = h - margin.bottom;

    // X scale for node positions along the axis
    const x = d3.scalePoint()
      .domain(nodes.map(d => d.id))
      .range([margin.left + 40, w - margin.right - 40])
      .padding(0.5);

    // Arc generator
    function arcPath(d) {
      const x1 = x(d.source);
      const x2 = x(d.target);
      const midX = (x1 + x2) / 2;
      const dist = Math.abs(x2 - x1);
      const arcHeight = Math.min(dist * 0.5, h - margin.top - margin.bottom - 40);
      
      return `M ${x1} ${axisY} Q ${midX} ${axisY - arcHeight} ${x2} ${axisY}`;
    }

    // Color scale for conditions
    const conditions = Array.from(new Set(hospitalConditions.values()));
    const conditionColor = d3.scaleOrdinal()
      .domain(conditions)
      .range(['#1f4e79', '#2a6f97', '#4a8ab3', '#b23a48', '#d05661', '#6b7280']);

    // Draw arcs
    const arcG = svg.select('.arcs');
    arcG.selectAll('*').remove();

    const arcPaths = arcG.selectAll('path')
      .data(arcs)
      .enter()
      .append('path')
      .attr('d', arcPath)
      .attr('fill', 'none')
      .attr('stroke', d => conditionColor(d.condition))
      .attr('stroke-width', d => Math.max(1.5, Math.min(5, Math.sqrt(d.strength) * 0.4)))
      .attr('stroke-opacity', 0.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 1)
          .attr('stroke-width', d => Math.max(2.5, Math.min(7, Math.sqrt(d.strength) * 0.5)));
      })
      .on('mousemove', (event, d) => {
        const h1 = nodes[d.source].name;
        const h2 = nodes[d.target].name;
        tooltip.show(
          `<div style="font-weight:600;">Shared Condition</div>
          <div>${h1.length > 20 ? h1.slice(0, 20) + '…' : h1}</div>
          <div>↔</div>
          <div>${h2.length > 20 ? h2.slice(0, 20) + '…' : h2}</div>
          <div>Condition: ${d.condition}</div>
          <div>Similarity: ${d.strength} patients</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function(event, d) {
        d3.select(this)
          .attr('stroke-opacity', 0.5)
          .attr('stroke-width', d => Math.max(1.5, Math.min(5, Math.sqrt(d.strength) * 0.4)));
        tooltip.hide();
      });

    // Draw axis line
    arcG.append('line')
      .attr('x1', margin.left)
      .attr('x2', w - margin.right)
      .attr('y1', axisY)
      .attr('y2', axisY)
      .attr('stroke', '#e5e7eb')
      .attr('stroke-width', 2);

    // Draw nodes
    const nodeG = svg.select('.nodes');
    nodeG.selectAll('*').remove();

    const nodeCircles = nodeG.selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.id))
      .attr('cy', axisY)
      .attr('r', d => Math.max(5, Math.min(12, Math.sqrt(d.count) * 0.4)))
      .attr('fill', d => conditionColor(hospitalConditions.get(d.name)))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseenter', function(event, d) {
        d3.select(this).attr('r', d => Math.max(7, Math.min(15, Math.sqrt(d.count) * 0.5)));
        
        // Highlight connected arcs
        arcPaths.attr('stroke-opacity', arc => 
          (arc.source === d.id || arc.target === d.id) ? 1 : 0.15
        );
      })
      .on('mousemove', (event, d) => {
        const cond = hospitalConditions.get(d.name);
        const connections = arcs.filter(a => a.source === d.id || a.target === d.id).length;
        tooltip.show(
          `<div style="font-weight:600;">${d.name}</div>
          <div>Patients: ${d.count.toLocaleString()}</div>
          <div>Main Condition: ${cond}</div>
          <div>Similar Hospitals: ${connections}</div>`,
          event.clientX,
          event.clientY
        );
      })
      .on('mouseleave', function(event, d) {
        d3.select(this).attr('r', d => Math.max(5, Math.min(12, Math.sqrt(d.count) * 0.4)));
        arcPaths.attr('stroke-opacity', 0.5);
        tooltip.hide();
      });

    // Draw labels
    const labelG = svg.select('.labels');
    labelG.selectAll('*').remove();

    labelG.selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('x', d => x(d.id))
      .attr('y', axisY + 18)
      .attr('text-anchor', 'middle')
      .attr('font-size', 9)
      .attr('fill', '#6b7280')
      .attr('transform', d => `rotate(45, ${x(d.id)}, ${axisY + 18})`)
      .text(d => d.name.length > 12 ? d.name.slice(0, 12) + '…' : d.name);
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.arcDiagram = { init, update };
})();
