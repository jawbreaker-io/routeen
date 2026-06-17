import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { reverseGeocode } from '../services/mapService';

export default function MapContainer({
  places,
  activeMode,
  sandboxPoints,
  timeline,
  activeRouteGeometry,
  activeRouteLoading,
  onAddPlace,
  onToggleSandboxPoint,
  onAddStopToActiveDay,
  theme,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const routePolylineRef = useRef(null);
  const tileLayerRef = useRef(null);
  // Only the setter is needed; the loading flag is consumed via the popup content.
  const [, setClickAddressLoading] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (mapInstanceRef.current) return;

    let center = [37.7749, -122.4194];
    if (places.length > 0) {
      const sumLat = places.reduce((sum, p) => sum + p.lat, 0);
      const sumLng = places.reduce((sum, p) => sum + p.lng, 0);
      center = [sumLat / places.length, sumLng / places.length];
    }

    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView(center, 13);

    // Initial tile layer selection based on theme
    const initialUrl =
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(initialUrl, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    routePolylineRef.current = L.polyline([], {
      color: '#6366f1',
      weight: 5,
      opacity: 0.85,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Map Click for Reverse Geocoding
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      
      const popup = L.popup()
        .setLatLng([lat, lng])
        .setContent('<div class="popup-loading">Fetching address details...</div>')
        .openOn(map);

      try {
        setClickAddressLoading(true);
        const result = await reverseGeocode(lat, lng);
        const displayName = result.address;
        
        const popupContent = `
          <div style="font-family: var(--font-sans); width: 220px; display: flex; flex-direction: column; gap: 8px;">
            <h4 style="font-size: 13px; margin: 0; color: var(--text-primary);">New Place</h4>
            <div style="font-size: 11px; color: var(--text-secondary); max-height: 48px; overflow: hidden; text-overflow: ellipsis;">
              ${displayName}
            </div>
            
            <input type="hidden" id="popup-place-lat" value="${lat}">
            <input type="hidden" id="popup-place-lng" value="${lng}">
            <input type="hidden" id="popup-place-address" value="${escapeHtml(displayName)}">
            
            <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
              <label style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Name</label>
              <input type="text" id="popup-place-name" placeholder="E.g., Gym, Cafe" 
                style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 6px 8px; border-radius: 4px; font-size: 12px; outline: none; width: 100%;">
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 9px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Type</label>
              <select id="popup-place-type" style="background: var(--bg-primary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 6px 8px; border-radius: 4px; font-size: 12px; outline: none;">
                <option value="other">Other / Stop</option>
                <option value="home">Home (Special)</option>
                <option value="office">Office (Special)</option>
              </select>
            </div>
            
            <button id="popup-btn-add" style="margin-top: 4px; padding: 6px 12px; background: var(--primary); border: none; border-radius: 6px; color: white; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s;">
              Save Location
            </button>
          </div>
        `;
        popup.setContent(popupContent);

        // Bind click event handler directly since the popup was already opened in loading state
        const container = popup.getElement();
        if (container) {
          const addBtn = container.querySelector('#popup-btn-add');
          if (addBtn) {
            addBtn.onclick = () => {
              const nameVal = container.querySelector('#popup-place-name').value;
              const typeVal = container.querySelector('#popup-place-type').value;
              const addrVal = container.querySelector('#popup-place-address').value;
              const latVal = parseFloat(container.querySelector('#popup-place-lat').value);
              const lngVal = parseFloat(container.querySelector('#popup-place-lng').value);

              onAddPlace({
                name: nameVal.trim() || 'Custom Stop',
                type: typeVal,
                address: addrVal,
                lat: latVal,
                lng: lngVal,
              });
              map.closePopup();
            };
          }
        }
      } catch {
        popup.setContent('<div class="popup-error">Could not fetch address. Click again.</div>');
      } finally {
        setClickAddressLoading(false);
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // Run once on mount: the map is initialized a single time and later effects
    // handle theme/marker/route updates. Re-running this would recreate the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map tile url when theme toggles
  useEffect(() => {
    const tileLayer = tileLayerRef.current;
    if (!tileLayer) return;

    const newUrl =
      theme === 'dark'
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

    tileLayer.setUrl(newUrl);
  }, [theme]);

  function escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Bind popup events
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handlePopupOpen = (e) => {
      const container = e.popup.getElement();
      
      const addBtn = container.querySelector('#popup-btn-add');
      if (addBtn) {
        addBtn.onclick = () => {
          const nameVal = container.querySelector('#popup-place-name').value;
          const typeVal = container.querySelector('#popup-place-type').value;
          const addrVal = container.querySelector('#popup-place-address').value;
          const latVal = parseFloat(container.querySelector('#popup-place-lat').value);
          const lngVal = parseFloat(container.querySelector('#popup-place-lng').value);

          onAddPlace({
            name: nameVal.trim() || 'Custom Stop',
            type: typeVal,
            address: addrVal,
            lat: latVal,
            lng: lngVal,
          });
          map.closePopup();
        };
      }

      const sandboxBtn = container.querySelector('#popup-btn-sandbox-toggle');
      if (sandboxBtn) {
        sandboxBtn.onclick = () => {
          const placeId = sandboxBtn.getAttribute('data-place-id');
          onToggleSandboxPoint(placeId);
          map.closePopup();
        };
      }

      const addToDayBtn = container.querySelector('#popup-btn-add-to-day');
      if (addToDayBtn) {
        addToDayBtn.onclick = () => {
          const placeId = addToDayBtn.getAttribute('data-place-id');
          const place = places.find(p => p.id === placeId);
          if (place) {
            onAddStopToActiveDay(place);
          }
          map.closePopup();
        };
      }
    };

    map.on('popupopen', handlePopupOpen);
    return () => {
      map.off('popupopen', handlePopupOpen);
    };
  }, [places, onAddPlace, onToggleSandboxPoint, onAddStopToActiveDay]);

  const createCustomIcon = (type, isSelectedInSandbox, indexInRoute) => {
    let iconClass = 'custom-marker';
    let innerHTML;

    if (indexInRoute !== undefined) {
      iconClass += ' route-point';
      innerHTML = `<span>${indexInRoute + 1}</span>`;
    } else if (type === 'home') {
      iconClass += ' home';
      innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
    } else if (type === 'office') {
      iconClass += ' office';
      innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="9" x2="15" y1="22" y2="22"/><line x1="9" x2="15" y1="18" y2="18"/><line x1="9" x2="15" y1="14" y2="14"/><line x1="9" x2="15" y1="10" y2="10"/><line x1="9" x2="15" y1="6" y2="6"/></svg>`;
    } else {
      iconClass += ' other';
      innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    }

    if (isSelectedInSandbox) {
      iconClass += ' sandbox-selected';
    }

    return L.divIcon({
      className: '',
      html: `<div class="${iconClass}">${innerHTML}</div>`,
      iconSize: indexInRoute !== undefined ? [24, 24] : [36, 36],
      iconAnchor: indexInRoute !== undefined ? [12, 24] : [18, 36],
      popupAnchor: [0, -32],
    });
  };

  // Redraw Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();

    places.forEach((place) => {
      const isSelectedInSandbox = activeMode === 'sandbox' && sandboxPoints.includes(place.id);
      const icon = createCustomIcon(place.type, isSelectedInSandbox, undefined);
      const marker = L.marker([place.lat, place.lng], { icon });

      const isHome = place.type === 'home';
      const isOffice = place.type === 'office';
      const typeLabel = isHome ? 'Home' : isOffice ? 'Office' : 'Saved Place';

      const sandboxToggleText = isSelectedInSandbox ? 'Remove from Sandbox' : 'Select for Sandbox';
      const sandboxBtnStyle = isSelectedInSandbox 
        ? 'background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.25); color: var(--danger);' 
        : 'background: var(--info-glow); border: 1px solid var(--border-color); color: var(--info);';

      const popupContent = `
        <div style="font-family: var(--font-sans); width: 220px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 6px;">
            <strong style="color: var(--text-primary); font-size: 13px;">${escapeHtml(place.name)}</strong>
            <span class="place-special-tag ${place.type}" style="font-size: 8px; font-weight: 700; text-transform: uppercase; padding: 1px 4px; border-radius: 4px;">${typeLabel}</span>
          </div>
          <div style="font-size: 11px; color: var(--text-secondary); line-height: 1.3;">
            ${escapeHtml(place.address)}
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 6px;">
            ${activeMode === 'sandbox' 
              ? `<button id="popup-btn-sandbox-toggle" data-place-id="${place.id}" style="padding: 6px; font-size: 11px; font-weight: 600; border-radius: 6px; cursor: pointer; transition: all 0.2s; ${sandboxBtnStyle}">${sandboxToggleText}</button>`
              : `<button id="popup-btn-add-to-day" data-place-id="${place.id}" style="padding: 6px; background: var(--primary); color: white; border: none; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer; transition: background 0.2s;">Add to Daily Route</button>`
            }
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.addTo(markersGroup);
    });

    if (activeMode === 'schedule' && timeline && timeline.length > 0) {
      timeline.forEach((stop, index) => {
        const isFixed = stop.isHomeStart || stop.isHomeEnd;
        const numberIcon = createCustomIcon(stop.placeType, false, isFixed ? undefined : index - 1);
        L.marker([stop.lat, stop.lng], { 
          icon: numberIcon,
          zIndexOffset: 100
        })
        .bindPopup(`
          <div style="font-family: var(--font-sans); width: 180px;">
            <div style="font-weight: 700; color: var(--text-primary);">
              ${stop.isHomeStart ? 'Start: Home' : stop.isHomeEnd ? 'End: Home' : `Stop #${index}`}
            </div>
            <div style="font-size: 12px; margin-top: 2px; color: var(--text-secondary);">${escapeHtml(stop.placeName)}</div>
            <div style="font-size: 10px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(stop.address)}</div>
          </div>
        `)
        .addTo(markersGroup);
      });
    } else if (activeMode === 'sandbox' && sandboxPoints.length > 0) {
      sandboxPoints.forEach((placeId, index) => {
        const place = places.find((p) => p.id === placeId);
        if (place) {
          const numberIcon = createCustomIcon(place.type, true, index);
          L.marker([place.lat, place.lng], { 
            icon: numberIcon,
            zIndexOffset: 100
          })
          .bindPopup(`
            <div style="font-family: var(--font-sans); width: 180px;">
              <div style="font-weight: 700; color: var(--info);">Sandbox Point #${index + 1}</div>
              <div style="font-size: 12px; margin-top: 2px; color: var(--text-primary);">${escapeHtml(place.name)}</div>
              <div style="font-size: 10px; color: var(--text-secondary); margin-top: 4px;">${escapeHtml(place.address)}</div>
            </div>
          `)
          .addTo(markersGroup);
        }
      });
    }

  }, [places, activeMode, sandboxPoints, timeline]);

  // Update Route Polyline
  useEffect(() => {
    const map = mapInstanceRef.current;
    const polyline = routePolylineRef.current;
    if (!map || !polyline) return;

    if (activeRouteGeometry && activeRouteGeometry.coordinates) {
      const latLngs = activeRouteGeometry.coordinates.map((coord) => [
        coord[1],
        coord[0],
      ]);

      polyline.setLatLngs(latLngs);
      
      if (activeMode === 'sandbox') {
        polyline.setStyle({ color: 'var(--info)', dashArray: '8, 8' });
      } else {
        polyline.setStyle({ color: 'var(--primary)', dashArray: null });
      }

      if (latLngs.length > 0) {
        map.fitBounds(polyline.getBounds(), { padding: [50, 50] });
      }
    } else {
      polyline.setLatLngs([]);
    }
  }, [activeRouteGeometry, activeMode]);

  // Fit bounds to all places
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || places.length === 0) return;

    if (!activeRouteGeometry) {
      const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
    }
    // Intentionally only re-fit when the number of places changes, not on every
    // coordinate edit or route-geometry update (the route effect handles those).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.length]);

  return (
    <div className="map-container-wrapper">
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

      {/* Loading Overlay */}
      {activeRouteLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.2)',
          backdropFilter: 'blur(2px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2000,
          pointerEvents: 'auto'
        }}>
          <div className="section-card" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-lg)' }}>
            <svg className="animate-spin" style={{ animation: 'spin 1s linear infinite', width: 20, height: 20, color: 'var(--primary)' }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" style={{ opacity: 0.25 }} />
              <path fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Computing Route...</span>
          </div>
        </div>
      )}

      {/* Floating Instruction Pill */}
      <div className="map-instructions">
        <div className="instruction-pill">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Click anywhere on the map to add a custom place</span>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .popup-loading {
          color: var(--text-secondary);
          font-size: 11px;
          font-family: var(--font-sans);
          padding: 8px 12px;
          text-align: center;
        }
        .popup-error {
          color: var(--danger);
          font-size: 11px;
          font-family: var(--font-sans);
          padding: 8px 12px;
          text-align: center;
        }
      `}</style>
    </div>
  );
}
