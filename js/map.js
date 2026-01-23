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
          zoom: 6,
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
          var hit = await view.hitTest(event);
          var graphic = hit.results?.find(function(r) { return r.graphic && r.graphic.layer && r.graphic.layer.id === 'hospitals'; })?.graphic;
          if (!graphic) return;

          var hospital = graphic.attributes?.hospital;
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
          var now = Date.now();
          if (now - lastHoverTime < 150) return; // Throttle to max ~7 updates/sec
          lastHoverTime = now;
          
          if (hoverHandle) cancelAnimationFrame(hoverHandle);
          hoverHandle = requestAnimationFrame(async () => {
            var hit = await view.hitTest(event);
            var graphic = hit.results?.find(function(r) { return r.graphic && r.graphic.layer && r.graphic.layer.id === 'hospitals'; })?.graphic;
            
            // Skip if same graphic
            if (graphic === lastHitGraphic) return;
            lastHitGraphic = graphic;
            
            if (!graphic) {
              // Use new API if available, fallback to old
              if (typeof view.closePopup === 'function') {
                view.closePopup();
              } else if (view.popup && typeof view.popup.close === 'function') {
                view.popup.close();
              }
              return;
            }
            // Use new API if available, fallback to old
            if (typeof view.openPopup === 'function') {
              view.openPopup({
                features: [graphic],
                location: graphic.geometry
              });
            } else if (view.popup && typeof view.popup.open === 'function') {
              view.popup.open({
                features: [graphic],
                location: graphic.geometry
              });
            }
          });
        });

        // ─────────────────────────────────────────────────────────────
        // Overview Map (minimap) in bottom-right corner using static image
        // ─────────────────────────────────────────────────────────────
        const overviewContainer = document.createElement('div');
        overviewContainer.id = 'overview-map';
        overviewContainer.style.cssText = `
          position: absolute;
          bottom: 25px;
          right: 10px;
          width: 150px;
          height: 100px;
          border-radius: 4px;
          overflow: hidden;
          background: url('assets/map_overview.png') center center / cover no-repeat;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2);
          z-index: 10;
        `;
        mapDiv.style.position = 'relative';
        mapDiv.appendChild(overviewContainer);

        // Canvas overlay for drawing the extent rectangle
        const overviewCanvas = document.createElement('canvas');
        overviewCanvas.width = 150;
        overviewCanvas.height = 100;
        overviewCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;';
        overviewContainer.appendChild(overviewCanvas);
        const ctx = overviewCanvas.getContext('2d');

        // USA bounds for coordinate mapping (approximate Web Mercator bounds for continental USA)
        const usaBounds = {
          minLon: -125,
          maxLon: -66,
          minLat: 24,
          maxLat: 50
        };

        // Convert geographic coordinates to canvas pixel coordinates
        function geoToCanvas(lon, lat) {
          const x = ((lon - usaBounds.minLon) / (usaBounds.maxLon - usaBounds.minLon)) * overviewCanvas.width;
          const y = ((usaBounds.maxLat - lat) / (usaBounds.maxLat - usaBounds.minLat)) * overviewCanvas.height;
          return { x, y };
        }

        // Convert canvas pixel coordinates to geographic coordinates
        function canvasToGeo(x, y) {
          const lon = (x / overviewCanvas.width) * (usaBounds.maxLon - usaBounds.minLon) + usaBounds.minLon;
          const lat = usaBounds.maxLat - (y / overviewCanvas.height) * (usaBounds.maxLat - usaBounds.minLat);
          return { lon, lat };
        }

        // Function to update the extent rectangle on canvas
        function updateExtentRectangle() {
          ctx.clearRect(0, 0, overviewCanvas.width, overviewCanvas.height);
          
          const extent = view.extent;
          if (!extent) return;

          // Convert extent coordinates to lat/lon (from Web Mercator if needed)
          let xmin, xmax, ymin, ymax;
          
          if (extent.spatialReference && extent.spatialReference.isWebMercator) {
            // Convert from Web Mercator to WGS84
            const toGeo = (x, y) => {
              const lon = (x / 20037508.34) * 180;
              let lat = (y / 20037508.34) * 180;
              lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
              return { lon, lat };
            };
            const min = toGeo(extent.xmin, extent.ymin);
            const max = toGeo(extent.xmax, extent.ymax);
            xmin = min.lon; ymin = min.lat;
            xmax = max.lon; ymax = max.lat;
          } else {
            xmin = extent.xmin; ymin = extent.ymin;
            xmax = extent.xmax; ymax = extent.ymax;
          }

          // Convert to canvas coordinates
          const topLeft = geoToCanvas(xmin, ymax);
          const bottomRight = geoToCanvas(xmax, ymin);

          const rectX = Math.max(0, topLeft.x);
          const rectY = Math.max(0, topLeft.y);
          const rectW = Math.min(overviewCanvas.width - rectX, bottomRight.x - topLeft.x);
          const rectH = Math.min(overviewCanvas.height - rectY, bottomRight.y - topLeft.y);

          // Draw the rectangle
          ctx.fillStyle = 'rgba(59, 130, 246, 0.25)';
          ctx.fillRect(rectX, rectY, rectW, rectH);
          
          ctx.strokeStyle = 'rgba(59, 130, 246, 1)';
          ctx.lineWidth = 2;
          ctx.strokeRect(rectX, rectY, rectW, rectH);
        }

        // Update rectangle when main view changes
        let isDraggingMinimap = false;
        view.watch('extent', () => {
          if (!isDraggingMinimap) {
            updateExtentRectangle();
          }
        });

        // Initial update after view is ready
        view.when(() => {
          updateExtentRectangle();
        });

        // ─────────────────────────────────────────────────────────────
        // Minimap drag interaction
        // ─────────────────────────────────────────────────────────────
        let dragStartPos = null;
        let dragStartCenter = null;

        overviewCanvas.style.cursor = 'grab';

        overviewCanvas.addEventListener('mousedown', (e) => {
          e.preventDefault();
          isDraggingMinimap = true;
          dragStartPos = { x: e.offsetX, y: e.offsetY };
          
          // Get current center of the main view in geo coordinates
          const center = view.center;
          if (center.spatialReference && center.spatialReference.isWebMercator) {
            const lon = (center.x / 20037508.34) * 180;
            let lat = (center.y / 20037508.34) * 180;
            lat = (180 / Math.PI) * (2 * Math.atan(Math.exp(lat * Math.PI / 180)) - Math.PI / 2);
            dragStartCenter = { lon, lat };
          } else {
            dragStartCenter = { lon: center.longitude, lat: center.latitude };
          }
          
          overviewCanvas.style.cursor = 'grabbing';
        });

        document.addEventListener('mousemove', (e) => {
          if (!isDraggingMinimap || !dragStartPos || !dragStartCenter) return;

          const rect = overviewCanvas.getBoundingClientRect();
          const currentX = e.clientX - rect.left;
          const currentY = e.clientY - rect.top;

          // Calculate delta in canvas pixels
          const deltaX = currentX - dragStartPos.x;
          const deltaY = currentY - dragStartPos.y;

          // Convert pixel delta to geo delta
          const lonPerPixel = (usaBounds.maxLon - usaBounds.minLon) / overviewCanvas.width;
          const latPerPixel = (usaBounds.maxLat - usaBounds.minLat) / overviewCanvas.height;

          const newLon = dragStartCenter.lon + deltaX * lonPerPixel;
          const newLat = dragStartCenter.lat - deltaY * latPerPixel;

          // Update main view center
          view.goTo({ center: [newLon, newLat] }, { animate: false });
          updateExtentRectangle();
        });

        document.addEventListener('mouseup', () => {
          if (isDraggingMinimap) {
            isDraggingMinimap = false;
            dragStartPos = null;
            dragStartCenter = null;
            overviewCanvas.style.cursor = 'grab';
          }
        });
      });
    }
  };
})();
