import { useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { HandTap, Clock, Timer, MapPin } from '@phosphor-icons/react';
import { reverseGeocode } from '../services/mapService';
import { getPlaceTypeMeta } from '../constants/placeTypes';
import { PLACE_TYPE_OPTIONS } from '../constants/placeTypes';

const ACCENT = '#ea2467';
const SANDBOX_COLOR = '#1f8fd0';
const FLOW_GOLD = '#ffb205';
const FLOW_CYAN = '#03bbd8';

const TILE_URLS = {
  light: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
  dark: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
};

function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// cache of rendered Phosphor glyph SVG markup, keyed by type
const iconSvgCache = {};
function iconSvg(type, size) {
  const key = `${type}-${size}`;
  if (!iconSvgCache[key]) {
    const { Icon } = getPlaceTypeMeta(type);
    iconSvgCache[key] = renderToStaticMarkup(
      <Icon size={size} color="#ffffff" weight="fill" />
    );
  }
  return iconSvgCache[key];
}

function makeMarkerIcon(type, number, { dim, ping }) {
  const { color } = getPlaceTypeMeta(type);
  const isHome = type === 'home';
  const size = isHome ? 40 : 34;
  const html = `
    <div class="rt-marker${dim ? ' dim' : ''}">
      ${ping ? `<span class="rt-marker-ping" style="background:${color}"></span>` : ''}
      <span class="rt-marker-disc${isHome ? ' home' : ''}" style="background:${color}">${iconSvg(type, isHome ? 17 : 16)}</span>
      ${number ? `<span class="rt-marker-badge">${number}</span>` : ''}
    </div>`;
  return L.divIcon({
    className: '',
    html,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -(size / 2) - 6],
  });
}

const popupActionStyle = (bg) =>
  `width:100%;margin-top:11px;border:none;cursor:pointer;border-radius:999px;padding:9px;font-size:12px;font-weight:700;color:#fff;background:${bg};display:flex;align-items:center;justify-content:center;gap:7px`;

function placePopupHtml(place, isSchedule, inSandbox) {
  const meta = getPlaceTypeMeta(place.type);
  const color = meta.color;
  const disc = `<span style="width:36px;height:36px;flex:none;border-radius:12px;display:grid;place-items:center;color:#fff;background:${color};box-shadow:0 3px 8px ${color}45">${iconSvg(place.type, 16)}</span>`;
  const tag = `<span style="display:inline-block;margin-top:3px;font-size:9px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:${color};background:${color}1a;border-radius:999px;padding:2px 7px">${escapeHtml(meta.label)}</span>`;

  let actionBtn;
  if (isSchedule) {
    actionBtn = `<button id="popup-btn-add-to-day" data-place-id="${place.id}" style="${popupActionStyle(ACCENT)}">add to route</button>`;
  } else if (inSandbox) {
    actionBtn = `<button id="popup-btn-sandbox-toggle" data-place-id="${place.id}" style="${popupActionStyle(ACCENT)}">remove from sandbox</button>`;
  } else {
    actionBtn = `<button id="popup-btn-sandbox-toggle" data-place-id="${place.id}" style="${popupActionStyle(SANDBOX_COLOR)}">add to sandbox</button>`;
  }

  return `
    <div style="width:222px;font-family:var(--font-sans)">
      <div style="display:flex;align-items:center;gap:9px">
        ${disc}
        <div style="min-width:0">
          <div style="font-family:var(--font-display);font-weight:600;font-size:15px;color:var(--rt-ink)">${escapeHtml(place.name)}</div>
          ${tag}
        </div>
      </div>
      <div style="font-size:11.5px;color:var(--fg-2);margin-top:9px;line-height:1.4">${escapeHtml(place.address)}</div>
      ${actionBtn}
    </div>`;
}

export default function MapContainer({
  places,
  activeMode,
  sandboxPoints,
  activeDaySchedule,
  timeline,
  activeRouteGeometry,
  activeRouteLoading,
  onAddPlace,
  onToggleSandboxPoint,
  onAddStopToActiveDay,
  theme,
  hud,
}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersGroupRef = useRef(null);
  const routeCasingRef = useRef(null);
  const routeLineRef = useRef(null);
  const routeFlowRef = useRef(null);
  const tileLayerRef = useRef(null);

  // Initialize map (once)
  useEffect(() => {
    if (mapInstanceRef.current) return;

    let center = [37.7749, -122.4194];
    if (places.length > 0) {
      const sumLat = places.reduce((s, p) => s + p.lat, 0);
      const sumLng = places.reduce((s, p) => s + p.lng, 0);
      center = [sumLat / places.length, sumLng / places.length];
    }

    const map = L.map(mapRef.current, { zoomControl: false }).setView(center, 13);

    tileLayerRef.current = L.tileLayer(theme === 'dark' ? TILE_URLS.dark : TILE_URLS.light, {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    markersGroupRef.current = L.layerGroup().addTo(map);
    // 3-layer candy route: white casing → accent line → animated flowing dash
    routeCasingRef.current = L.polyline([], {
      color: '#ffffff',
      weight: 9,
      opacity: 0.95,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    routeLineRef.current = L.polyline([], {
      color: ACCENT,
      weight: 4.5,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map);
    routeFlowRef.current = L.polyline([], {
      color: FLOW_GOLD,
      weight: 4.5,
      lineCap: 'round',
      lineJoin: 'round',
      dashArray: '2,12',
      className: 'rt-route-flow',
    }).addTo(map);

    mapInstanceRef.current = map;

    // Click empty map → reverse geocode → candy "new place" popup
    map.on('click', async (e) => {
      const { lat, lng } = e.latlng;
      const popup = L.popup()
        .setLatLng([lat, lng])
        .setContent(
          '<div style="padding:8px 12px;font-size:12px;color:var(--fg-2);font-family:var(--font-sans)">finding address…</div>'
        )
        .openOn(map);

      try {
        const result = await reverseGeocode(lat, lng);
        const displayName = result.address;
        const typeOptions = PLACE_TYPE_OPTIONS.map(
          (o) => `<option value="${o.value}">${o.label}</option>`
        ).join('');

        popup.setContent(`
          <div style="width:230px;font-family:var(--font-sans);display:flex;flex-direction:column;gap:9px">
            <div style="display:flex;align-items:center;gap:7px"><span style="font-family:var(--font-display);font-weight:600;font-size:14px;color:var(--rt-ink)">new place here</span></div>
            <div style="font-size:11px;color:var(--fg-3);line-height:1.35;max-height:46px;overflow:hidden">${escapeHtml(displayName)}</div>
            <input type="hidden" id="popup-place-lat" value="${lat}" />
            <input type="hidden" id="popup-place-lng" value="${lng}" />
            <input type="hidden" id="popup-place-address" value="${escapeHtml(displayName)}" />
            <input type="text" id="popup-place-name" placeholder="name this spot" style="border:1px solid var(--rt-line);background:var(--rt-bg2);border-radius:10px;padding:8px 11px;font-size:12.5px;color:var(--rt-ink);width:100%" />
            <select id="popup-place-type" style="appearance:none;-webkit-appearance:none;border:1px solid var(--rt-line);background:var(--rt-bg2);border-radius:10px;padding:8px 11px;font-size:12.5px;font-weight:600;color:var(--rt-ink);cursor:pointer;width:100%">${typeOptions}</select>
            <button id="popup-btn-add" style="border:none;background:var(--candy-green);color:#fff;border-radius:999px;padding:9px;font-size:12px;font-weight:700;cursor:pointer;width:100%">drop pin</button>
          </div>
        `);

        const container = popup.getElement();
        const addBtn = container?.querySelector('#popup-btn-add');
        if (addBtn) {
          addBtn.onclick = () => {
            const nameVal = container.querySelector('#popup-place-name').value;
            const typeVal = container.querySelector('#popup-place-type').value;
            const addrVal = container.querySelector('#popup-place-address').value;
            onAddPlace({
              name: nameVal.trim() || 'Custom Stop',
              type: typeVal,
              address: addrVal,
              lat: parseFloat(container.querySelector('#popup-place-lat').value),
              lng: parseFloat(container.querySelector('#popup-place-lng').value),
            });
            map.closePopup();
          };
        }
      } catch {
        popup.setContent(
          '<div style="padding:8px 12px;font-size:12px;color:var(--candy-raspberry);font-family:var(--font-sans)">Could not fetch address. Tap again.</div>'
        );
      }
    });

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Theme → tiles
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(theme === 'dark' ? TILE_URLS.dark : TILE_URLS.light);
    }
  }, [theme]);

  // Rebind popup action buttons when handlers/data change
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const handlePopupOpen = (e) => {
      const container = e.popup.getElement();
      if (!container) return;

      const addToDayBtn = container.querySelector('#popup-btn-add-to-day');
      if (addToDayBtn) {
        addToDayBtn.onclick = () => {
          const place = places.find((p) => p.id === addToDayBtn.getAttribute('data-place-id'));
          if (place) onAddStopToActiveDay(place);
          map.closePopup();
        };
      }

      const sandboxBtn = container.querySelector('#popup-btn-sandbox-toggle');
      if (sandboxBtn) {
        sandboxBtn.onclick = () => {
          onToggleSandboxPoint(sandboxBtn.getAttribute('data-place-id'));
          map.closePopup();
        };
      }
    };

    map.on('popupopen', handlePopupOpen);
    return () => map.off('popupopen', handlePopupOpen);
  }, [places, onAddStopToActiveDay, onToggleSandboxPoint]);

  // Redraw candy markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersGroup = markersGroupRef.current;
    if (!map || !markersGroup) return;

    markersGroup.clearLayers();
    const isSchedule = activeMode === 'schedule';

    // route order: first appearance of each place in the active day's schedule
    const order = {};
    if (isSchedule) {
      (activeDaySchedule || []).forEach((s, i) => {
        if (order[s.placeId] === undefined) order[s.placeId] = i + 1;
      });
    }

    places.forEach((place) => {
      let number;
      let inRoute;
      let ping = false;

      if (isSchedule) {
        inRoute = place.type === 'home' || order[place.id] !== undefined;
        number = place.type === 'home' ? '' : order[place.id] || '';
      } else {
        const idx = sandboxPoints.indexOf(place.id);
        inRoute = idx >= 0;
        ping = idx >= 0;
        number = idx >= 0 ? idx + 1 : '';
      }

      const icon = makeMarkerIcon(place.type, number, { dim: !inRoute, ping });
      const marker = L.marker([place.lat, place.lng], {
        icon,
        zIndexOffset: !inRoute ? 0 : ping ? 300 : 120,
      });
      marker.bindPopup(placePopupHtml(place, isSchedule, sandboxPoints.includes(place.id)));
      marker.addTo(markersGroup);
    });
  }, [places, activeMode, sandboxPoints, activeDaySchedule, timeline]);

  // Update route polylines
  useEffect(() => {
    const map = mapInstanceRef.current;
    const casing = routeCasingRef.current;
    const line = routeLineRef.current;
    const flow = routeFlowRef.current;
    if (!map || !casing || !line || !flow) return;

    if (activeRouteGeometry && activeRouteGeometry.coordinates) {
      const latLngs = activeRouteGeometry.coordinates.map((c) => [c[1], c[0]]);
      casing.setLatLngs(latLngs);
      line.setLatLngs(latLngs);
      flow.setLatLngs(latLngs);

      const isSchedule = activeMode === 'schedule';
      line.setStyle({ color: isSchedule ? ACCENT : SANDBOX_COLOR });
      flow.setStyle({ color: isSchedule ? FLOW_GOLD : FLOW_CYAN });

      if (latLngs.length > 0) {
        map.fitBounds(casing.getBounds(), { padding: [60, 60] });
      }
    } else {
      casing.setLatLngs([]);
      line.setLatLngs([]);
      flow.setLatLngs([]);
    }
  }, [activeRouteGeometry, activeMode]);

  // Fit to all places when the count changes (and no route drawn)
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || places.length === 0) return;
    if (!activeRouteGeometry) {
      const bounds = L.latLngBounds(places.map((p) => [p.lat, p.lng]));
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places.length]);

  return (
    <main className="map-container-wrapper">
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />

      {activeRouteLoading && (
        <div className="map-loading-overlay">
          <div className="map-loading-card">
            <span className="spinner" />
            computing route…
          </div>
        </div>
      )}

      {hud && (
        <div className="rt-hud">
          <div className="rt-hud-head">
            <span className="jb-mark jb-mark--sm" style={{ width: 22, height: 22 }} />
            <span className="rt-hud-title">{hud.title}</span>
          </div>
          <div className="rt-hud-distance">{hud.distance}</div>
          <div className="rt-hud-sub">miles round trip</div>
          <div className="rt-hud-divider" />
          <div className="rt-hud-rows">
            <div className="rt-hud-row">
              <span className="label">
                <Clock size={14} weight="bold" style={{ color: 'var(--candy-blue)' }} /> drive time
              </span>
              <span className="value">{hud.duration}</span>
            </div>
            <div className="rt-hud-row">
              <span className="label">
                <Timer size={14} weight="bold" style={{ color: 'var(--candy-green)' }} /> day length
              </span>
              <span className="value">{hud.dayLength}</span>
            </div>
            <div className="rt-hud-row">
              <span className="label">
                <MapPin size={14} weight="bold" style={{ color: 'var(--candy-raspberry)' }} /> stops
              </span>
              <span className="value">{hud.stops}</span>
            </div>
          </div>
        </div>
      )}

      <div className="map-instructions">
        <div className="instruction-pill">
          <HandTap className="pill-icon" size={16} weight="fill" />
          <span>
            {activeMode === 'schedule'
              ? 'tap the map to add a place · tap a marker for options'
              : 'tap markers to build a sandbox route'}
          </span>
        </div>
      </div>
    </main>
  );
}
