// Geocoding using Nominatim (OpenStreetMap)
export async function geocodeAddress(address, limitToUsa = true, bounds = null) {
  try {
    // OpenStreetMap's Nominatim index has initials formatted with dots (e.g. "T.W. Alexander Dr" instead of "tw alexander dr").
    // Normalize "tw" to "T.W." to ensure it matches correctly.
    const normalizedAddress = address.replace(/\btw\b/gi, 'T.W.');

    let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      normalizedAddress
    )}&limit=5`;

    if (limitToUsa) {
      url += `&countrycodes=us`;
    }

    if (bounds) {
      // bounds: { minLng, maxLat, maxLng, minLat }
      url += `&viewbox=${bounds.minLng},${bounds.maxLat},${bounds.maxLng},${bounds.minLat}&bounded=1`;
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Geocoding request failed');
    }
    const data = await response.json();
    return data.map((item) => ({
      name: item.name || '',
      address: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
    }));
  } catch (error) {
    console.error('Error in geocodeAddress:', error);
    throw error;
  }
}

// Reverse geocoding using Nominatim (OpenStreetMap)
export async function reverseGeocode(lat, lng) {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
    );
    if (!response.ok) {
      throw new Error('Reverse geocoding request failed');
    }
    const data = await response.json();
    return {
      address: data.display_name,
      lat,
      lng,
    };
  } catch (error) {
    console.error('Error in reverseGeocode:', error);
    throw error;
  }
}

// Calculate routing using OSRM
export async function getRoute(coordinates) {
  if (coordinates.length < 2) {
    return null;
  }

  // coordinates should be an array of {lat, lng}
  const coordString = coordinates.map((c) => `${c.lng},${c.lat}`).join(';');
  const url = `https://router.project-osrm.org/route/v1/driving/${coordString}?overview=full&geometries=geojson&steps=true`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('OSRM routing request failed');
    }
    const data = await response.json();

    if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
      throw new Error(data.message || 'No route found');
    }

    const route = data.routes[0];
    const distanceMeters = route.distance;
    const durationSeconds = route.duration;
    
    // Convert to miles (1 meter = 0.000621371 miles)
    const distanceMiles = distanceMeters * 0.000621371;
    // Convert to minutes
    const durationMinutes = durationSeconds / 60;

    // Extract step-by-step directions
    const steps = [];
    if (route.legs) {
      route.legs.forEach((leg, legIndex) => {
        leg.steps.forEach((step) => {
          if (step.maneuver && step.name) {
            steps.push({
              instruction: `${step.maneuver.type} ${step.maneuver.modifier || ''} on ${step.name || 'unnamed road'}`.trim(),
              distance: step.distance * 0.000621371, // miles
              duration: step.duration / 60, // minutes
              legIndex,
            });
          }
        });
      });
    }

    return {
      geometry: route.geometry, // GeoJSON line string
      distance: distanceMiles,
      duration: durationMinutes,
      steps,
      raw: route,
    };
  } catch (error) {
    console.error('Error in getRoute:', error);
    throw error;
  }
}
