(function () {
  if (!window.App) throw new Error('App state not initialized');

  window.App.map = {
    init() {
      const mapDiv = document.getElementById('map');
      if (!mapDiv) return;

      // If ArcGIS failed to load (offline, blocked), don't crash the page.
      if (typeof window.require !== 'function') {
        mapDiv.innerHTML = '<div style="padding:12px;font-size:12px;color:#6b7280;">ArcGIS API not available. Check your internet connection.</div>';
        return;
      }

      window.require([
        'esri/Map',
        'esri/views/MapView',
        'esri/layers/GraphicsLayer',
        'esri/Graphic'
      ], (Map, MapView, GraphicsLayer, Graphic) => {
        const map = new Map({ basemap: 'gray-vector' });
        const layer = new GraphicsLayer({ id: 'hospitals' });
        map.add(layer);

        const view = new MapView({
          container: mapDiv,
          map,
          center: [-74, 40.7],
          zoom: 8,
          constraints: { minZoom: 3 }
        });

        function buildGraphics(stats) {
          const { hospitalToLonLat } = window.App.utils.geo;
          const { formatMoney, formatNumber } = window.App.utils.format;
          const palette = window.App.config.palette;

          const maxCount = d3.max(stats, d => d.count) || 1;
          const size = d3.scaleSqrt().domain([1, maxCount]).range([8, 22]);

          return stats.map(s => {
            const pos = hospitalToLonLat(s.hospital);
            const dominant = s.dominantTestResult || 'Inconclusive';
            const isSelected = window.App.state.selectedHospital === s.hospital;

            const symbol = {
              type: 'simple-marker',
              style: 'circle',
              size: size(Math.max(1, s.count)),
              color: palette[dominant] || '#6b7280',
              outline: {
                color: isSelected ? '#111827' : '#ffffff',
                width: isSelected ? 2 : 1
              }
            };

            const attributes = {
              hospital: s.hospital,
              patients: s.count,
              avgBilling: s.avgBilling,
              dominant
            };

            const popupTemplate = {
              title: '{hospital}',
              content:
                `<div style="font-size:12px;line-height:1.35;">` +
                `<div><b>Patients:</b> {patients}</div>` +
                `<div><b>Avg billing:</b> ${formatMoney(s.avgBilling)}</div>` +
                `<div><b>Dominant result:</b> {dominant}</div>` +
                `<div style="margin-top:6px;opacity:0.85;">Click marker to filter charts</div>` +
                `</div>`
            };

            return new Graphic({
              geometry: { type: 'point', longitude: pos.lon, latitude: pos.lat },
              symbol,
              attributes,
              popupTemplate
            });
          });
        }

        // Performance: Cache for map stats
        let lastMapStatsKey = null;
        let lastMapStats = null;

        function getMapStatsKey(filters) {
          return JSON.stringify({
            ageGroup: filters.ageGroup,
            gender: filters.gender,
            admissionType: filters.admissionType,
            condition: filters.condition,
            testResult: filters.testResult,
            billingRange: filters.billingRange
          });
        }

        function refreshLayer(rows) {
          // Important: use filtered rows WITHOUT hospital selection so the map stays informative.
          // Otherwise selecting a hospital would collapse the map into a single point.
          const savedHospital = window.App.state.selectedHospital;
          const { filters } = window.App.state;
          
          // Check cache first
          const cacheKey = getMapStatsKey(filters);
          if (cacheKey === lastMapStatsKey && lastMapStats) {
            // Just rebuild graphics with potentially different selection
            window.App.state.selectedHospital = savedHospital;
            layer.removeAll();
            layer.addMany(buildGraphics(lastMapStats));
            return;
          }

          window.App.state.selectedHospital = null;
          const fauxFiltered = (() => {
            // Re-run the filter logic quickly but without hospital constraint.
            const { raw, filters } = window.App.state;
            const out = [];
            const len = raw.length;
            for (let i = 0; i < len; i++) {
              const r = raw[i];
              if (filters.ageGroup !== 'all' && r.ageGroup !== filters.ageGroup) continue;
              if (filters.gender !== 'all' && r.gender !== filters.gender) continue;
              if (filters.admissionType !== 'all' && r.admissionType !== filters.admissionType) continue;
              if (filters.condition !== 'all' && r.medicalCondition !== filters.condition) continue;
              if (filters.testResult !== 'all' && r.testResult !== filters.testResult) continue;
              if (filters.billingRange) {
                if (r.billingAmount == null) continue;
                if (r.billingAmount < filters.billingRange[0] || r.billingAmount > filters.billingRange[1]) continue;
              }
              out.push(r);
            }
            return out;
          })();
          window.App.state.selectedHospital = savedHospital;

          const stats = window.App.data.computeHospitalStats(fauxFiltered);
          lastMapStatsKey = cacheKey;
          lastMapStats = stats;
          
          layer.removeAll();
          layer.addMany(buildGraphics(stats));
        }

        // Update map as soon as data arrives.
        window.App.events.on('data:loaded', ({ rows }) => {
          refreshLayer(rows);
        });
        
        // Performance: Debounce map updates more aggressively
        let mapUpdatePending = false;
        window.App.events.on('data:filtered', ({ rows }) => {
          if (mapUpdatePending) return;
          mapUpdatePending = true;
          
          if (window.App._mapUpdateTimeout) clearTimeout(window.App._mapUpdateTimeout);
          window.App._mapUpdateTimeout = setTimeout(() => {
            mapUpdatePending = false;
            requestAnimationFrame(() => refreshLayer(rows));
          }, 150);
        });
        window.App.events.on('selection:reset', () => {
          lastMapStatsKey = null; // Invalidate cache
          requestAnimationFrame(() => refreshLayer(window.App.state.filtered));
        });

        // Click: select hospital and filter dashboard.
        view.on('click', async (event) => {
          const hit = await view.hitTest(event);
          const g = hit.results?.find(r => r.graphic && r.graphic.layer && r.graphic.layer.id === 'hospitals')?.graphic;
          if (!g) return;

          const hospital = g.attributes?.hospital;
          if (!hospital) return;

          // Toggle selection.
          window.App.state.selectedHospital = (window.App.state.selectedHospital === hospital) ? null : hospital;
          window.App.data.applyFilters();
        });

        // Hover popup: pragmatic (not perfect) hitTest on pointer-move with throttling.
        let hoverHandle = null;
        let lastHoverTime = 0;
        let lastHitGraphic = null;
        
        view.on('pointer-move', async (event) => {
          const now = Date.now();
          if (now - lastHoverTime < 150) return; // Throttle to max ~7 updates/sec
          lastHoverTime = now;
          
          if (hoverHandle) cancelAnimationFrame(hoverHandle);
          hoverHandle = requestAnimationFrame(async () => {
            const hit = await view.hitTest(event);
            const g = hit.results?.find(r => r.graphic && r.graphic.layer && r.graphic.layer.id === 'hospitals')?.graphic;
            
            // Skip if same graphic
            if (g === lastHitGraphic) return;
            lastHitGraphic = g;
            
            if (!g) {
              view.popup.close();
              return;
            }
            view.popup.open({
              features: [g],
              location: g.geometry
            });
          });
        });
      });
    }
  };
})();
