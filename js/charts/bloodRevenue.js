(function () {
  if (!window.App) throw new Error('App state not initialized');

  // Cache for preventing unnecessary redraws
  let lastDataHash = null;
  let chartState = null;

  function hashData(data) {
    if (!data || !data.length) return '';
    return data.map(d => `${d.bloodType}:${d.revenue.toFixed(0)}`).join('|');
  }

  function init(root) {
    const container = typeof root === 'string' ? document.getElementById(root) : root;
    if (!container) return;
    
    // Initialize SVG structure once
    container.innerHTML = '';
    const margin = { top: 20, right: 80, bottom: 20, left: 60 };
    
    const svg = d3.select(container)
      .append('svg')
      .attr('class', 'blood-chart-svg');
    
    svg.append('g').attr('class', 'bars-group');
    svg.append('g').attr('class', 'labels-group');
    svg.append('g').attr('class', 'y-axis');
    svg.append('g').attr('class', 'x-axis');
    
    chartState = { svg, margin, container };
    lastDataHash = null;
  }

  function update(rows) {
    if (!chartState) return;
    
    const { svg, margin, container } = chartState;
    if (!svg || !container) return;

    const filteredRows = rows || window.App.state.filtered || [];
    if (!filteredRows.length) {
      svg.selectAll('.bars-group *').remove();
      svg.selectAll('.labels-group *').remove();
      return;
    }

    // Calculate total billing amount per blood type (optimized)
    const blood_stats = new Map();
    for (let i = 0; i < filteredRows.length; i++) {
      const row = filteredRows[i];
      const blood = row.bloodType || 'Unknown';
      blood_stats.set(blood, (blood_stats.get(blood) || 0) + (row.billingAmount || 0));
    }

    const data = Array.from(blood_stats.entries())
      .map(([bloodType, revenue]) => ({ bloodType, revenue }))
      .sort((a, b) => b.revenue - a.revenue);

    // Check if data changed (skip redraw if same)
    const currentHash = hashData(data);
    if (currentHash === lastDataHash) return;
    lastDataHash = currentHash;

    const containerWidth = container.offsetWidth || 680;
    const width = containerWidth - margin.left - margin.right;
    const height = Math.max(200, data.length * 35);

    svg
      .attr('width', containerWidth)
      .attr('height', height + margin.top + margin.bottom);

    const xScale = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.revenue) * 1.1])
      .range([0, width]);

    const yScale = d3.scaleBand()
      .domain(data.map(d => d.bloodType))
      .range([0, height])
      .padding(0.3);

    const colors = ['#1f4e79', '#2a6f97', '#4a8ab3', '#6fa3c4', '#94bcd5', '#b23a48', '#d05661', '#6b7280'];
    const fmt = window.App.utils?.format?.formatMoney;

    // Update bars with transition
    const barsGroup = svg.select('.bars-group')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const bars = barsGroup.selectAll('.bar')
      .data(data, d => d.bloodType);

    bars.exit()
      .transition().duration(200)
      .attr('width', 0)
      .remove();

    bars.enter()
      .append('rect')
      .attr('class', 'bar')
      .attr('x', 0)
      .attr('y', d => yScale(d.bloodType))
      .attr('height', yScale.bandwidth())
      .attr('fill', (d, i) => colors[i % colors.length])
      .attr('width', 0)
      .merge(bars)
      .transition().duration(300)
      .attr('y', d => yScale(d.bloodType))
      .attr('width', d => xScale(d.revenue))
      .attr('height', yScale.bandwidth());

    // Update labels with transition
    const labelsGroup = svg.select('.labels-group')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const labels = labelsGroup.selectAll('.label')
      .data(data, d => d.bloodType);

    labels.exit().remove();

    labels.enter()
      .append('text')
      .attr('class', 'label')
      .attr('dy', '0.35em')
      .attr('font-size', '12px')
      .attr('fill', '#374151')
      .attr('font-family', 'Poppins, sans-serif')
      .attr('font-weight', '500')
      .merge(labels)
      .transition().duration(300)
      .attr('x', d => xScale(d.revenue) + 5)
      .attr('y', d => yScale(d.bloodType) + yScale.bandwidth() / 2)
      .text(d => fmt ? fmt(d.revenue) : `$${d.revenue.toLocaleString()}`);

    // Update axes
    svg.select('.y-axis')
      .attr('transform', `translate(${margin.left},${margin.top})`)
      .transition().duration(300)
      .call(d3.axisLeft(yScale))
      .attr('font-family', 'Poppins, sans-serif')
      .attr('font-size', '12px');

    svg.select('.x-axis')
      .attr('transform', `translate(${margin.left},${margin.top + height})`)
      .transition().duration(300)
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => `$${(d / 1000000).toFixed(0)}M`))
      .attr('font-family', 'Poppins, sans-serif')
      .attr('font-size', '12px');
  }

  window.App.chartModules = window.App.chartModules || {};
  window.App.chartModules.bloodRevenue = { init, update };
})();
