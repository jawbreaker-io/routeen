import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { geocodeAddress, reverseGeocode, getRoute } from './mapService';

// Helper to build a fake fetch Response
const okJson = (data) => ({ ok: true, json: async () => data });
const notOk = () => ({ ok: false, json: async () => ({}) });

// Capture the URL passed to the most recent fetch call
const lastUrl = () => globalThis.fetch.mock.calls.at(-1)[0];

describe('mapService', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
    // Silence expected error logging from the service's catch blocks
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('geocodeAddress', () => {
    const sampleResult = [
      { name: 'Place A', display_name: '123 Main St, Town, USA', lat: '35.5', lon: '-78.25' },
    ];

    it('maps the Nominatim response to {name, address, lat, lng} with numeric coords', async () => {
      globalThis.fetch.mockResolvedValue(okJson(sampleResult));

      const result = await geocodeAddress('123 Main St');

      expect(result).toEqual([
        { name: 'Place A', address: '123 Main St, Town, USA', lat: 35.5, lng: -78.25 },
      ]);
    });

    it('defaults name to empty string when Nominatim omits it', async () => {
      globalThis.fetch.mockResolvedValue(okJson([{ display_name: 'Somewhere', lat: '1', lon: '2' }]));

      const [item] = await geocodeAddress('Somewhere');

      expect(item.name).toBe('');
    });

    it('requests the search endpoint with the encoded query and a limit of 5', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      await geocodeAddress('123 Main St');

      const url = lastUrl();
      expect(url).toContain('https://nominatim.openstreetmap.org/search');
      expect(url).toContain('format=json');
      expect(url).toContain(`q=${encodeURIComponent('123 Main St')}`);
      expect(url).toContain('limit=5');
    });

    it('normalizes a standalone "tw" token to "T.W." in the query', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      await geocodeAddress('tw alexander dr');

      expect(lastUrl()).toContain(`q=${encodeURIComponent('T.W. alexander dr')}`);
    });

    it('does not rewrite "tw" when it is part of a larger word', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      await geocodeAddress('twin lakes');

      expect(lastUrl()).toContain(`q=${encodeURIComponent('twin lakes')}`);
    });

    it('adds countrycodes=us by default (limitToUsa defaults to true)', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      await geocodeAddress('anywhere');

      expect(lastUrl()).toContain('countrycodes=us');
    });

    it('omits countrycodes when limitToUsa is false', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      await geocodeAddress('anywhere', false);

      expect(lastUrl()).not.toContain('countrycodes=us');
    });

    it('appends a bounded viewbox when bounds are provided', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      const bounds = { minLng: -79, maxLat: 36, maxLng: -77, minLat: 34 };
      await geocodeAddress('anywhere', true, bounds);

      const url = lastUrl();
      expect(url).toContain('viewbox=-79,36,-77,34');
      expect(url).toContain('bounded=1');
    });

    it('does not append a viewbox when no bounds are given', async () => {
      globalThis.fetch.mockResolvedValue(okJson([]));

      await geocodeAddress('anywhere');

      expect(lastUrl()).not.toContain('viewbox=');
    });

    it('throws when the response is not ok', async () => {
      globalThis.fetch.mockResolvedValue(notOk());

      await expect(geocodeAddress('x')).rejects.toThrow('Geocoding request failed');
    });

    it('propagates fetch rejections', async () => {
      globalThis.fetch.mockRejectedValue(new Error('network down'));

      await expect(geocodeAddress('x')).rejects.toThrow('network down');
    });
  });

  describe('reverseGeocode', () => {
    it('returns {address, lat, lng} from the reverse endpoint', async () => {
      globalThis.fetch.mockResolvedValue(okJson({ display_name: '1 Infinite Loop' }));

      const result = await reverseGeocode(37.33, -122.03);

      expect(result).toEqual({ address: '1 Infinite Loop', lat: 37.33, lng: -122.03 });
    });

    it('requests the reverse endpoint with the given coordinates', async () => {
      globalThis.fetch.mockResolvedValue(okJson({ display_name: 'x' }));

      await reverseGeocode(37.33, -122.03);

      const url = lastUrl();
      expect(url).toContain('https://nominatim.openstreetmap.org/reverse');
      expect(url).toContain('lat=37.33');
      expect(url).toContain('lon=-122.03');
    });

    it('throws when the response is not ok', async () => {
      globalThis.fetch.mockResolvedValue(notOk());

      await expect(reverseGeocode(0, 0)).rejects.toThrow('Reverse geocoding request failed');
    });
  });

  describe('getRoute', () => {
    const coords = [
      { lat: 35.0, lng: -78.0 },
      { lat: 35.5, lng: -78.5 },
    ];

    // 1609.344 m ≈ 1 mile, 3600 s = 60 min
    const routeResponse = {
      code: 'Ok',
      routes: [
        {
          distance: 1609.344,
          duration: 3600,
          geometry: { type: 'LineString', coordinates: [[-78, 35], [-78.5, 35.5]] },
          legs: [
            {
              steps: [
                { maneuver: { type: 'depart', modifier: 'left' }, name: 'Main St', distance: 1609.344, duration: 600 },
                { maneuver: { type: 'turn' }, name: '', distance: 100, duration: 60 },
              ],
            },
          ],
        },
      ],
    };

    it('returns null when given fewer than two coordinates', async () => {
      const result = await getRoute([{ lat: 1, lng: 2 }]);
      expect(result).toBeNull();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    it('builds the OSRM url with lng,lat pairs joined by semicolons', async () => {
      globalThis.fetch.mockResolvedValue(okJson(routeResponse));

      await getRoute(coords);

      const url = lastUrl();
      expect(url).toContain('https://router.project-osrm.org/route/v1/driving/-78,35;-78.5,35.5');
      expect(url).toContain('overview=full');
      expect(url).toContain('geometries=geojson');
      expect(url).toContain('steps=true');
    });

    it('converts distance to miles and duration to minutes', async () => {
      globalThis.fetch.mockResolvedValue(okJson(routeResponse));

      const result = await getRoute(coords);

      expect(result.distance).toBeCloseTo(1, 3);
      expect(result.duration).toBeCloseTo(60, 3);
      expect(result.geometry).toEqual(routeResponse.routes[0].geometry);
    });

    it('extracts only steps that have both a maneuver and a name', async () => {
      globalThis.fetch.mockResolvedValue(okJson(routeResponse));

      const result = await getRoute(coords);

      // Second step has an empty name and is filtered out
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toMatchObject({
        instruction: 'depart left on Main St',
        legIndex: 0,
      });
      expect(result.steps[0].distance).toBeCloseTo(1, 3);
      expect(result.steps[0].duration).toBeCloseTo(10, 3);
    });

    it('throws when OSRM reports a non-Ok code', async () => {
      globalThis.fetch.mockResolvedValue(okJson({ code: 'NoRoute', message: 'No route found' }));

      await expect(getRoute(coords)).rejects.toThrow('No route found');
    });

    it('throws when the routes array is empty', async () => {
      globalThis.fetch.mockResolvedValue(okJson({ code: 'Ok', routes: [] }));

      await expect(getRoute(coords)).rejects.toThrow();
    });

    it('throws when the response is not ok', async () => {
      globalThis.fetch.mockResolvedValue(notOk());

      await expect(getRoute(coords)).rejects.toThrow('OSRM routing request failed');
    });
  });
});
