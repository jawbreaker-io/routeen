import { useState, useEffect, useRef } from 'react';
import Sidebar from './components/Sidebar';
import MapContainer from './components/MapContainer';
import { getRoute } from './services/mapService';

const SEED_PLACES = [
  { id: 'p1', name: 'Home', type: 'home', address: '100 Pine St, San Francisco, CA 94111', lat: 37.7925, lng: -122.3999 },
  { id: 'p2', name: 'Salesforce Office', type: 'office', address: '415 Mission St, San Francisco, CA 94105', lat: 37.7897, lng: -122.3972 },
  { id: 'p3', name: 'City Gym', type: 'other', address: '201 Berry St, San Francisco, CA 94158', lat: 37.7765, lng: -122.3934 },
  { id: 'p4', name: 'Whole Foods Market', type: 'other', address: '2300 16th St, San Francisco, CA 94103', lat: 37.7663, lng: -122.4093 }
];

const SEED_SCHEDULES = {
  monday: [
    { id: 's1', placeId: 'p1', stayDuration: 0 },
    { id: 's2', placeId: 'p2', stayDuration: 480 },
    { id: 's3', placeId: 'p3', stayDuration: 60 },
    { id: 's4', placeId: 'p4', stayDuration: 30 },
    { id: 's5', placeId: 'p1', stayDuration: 0 }
  ],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: []
};

const SEED_START_TIMES = {
  monday: '08:00',
  tuesday: '08:00',
  wednesday: '08:00',
  thursday: '08:00',
  friday: '08:00',
  saturday: '09:00',
  sunday: '09:00'
};

function haversineDistance(c1, c2) {
  const R = 3958.8;
  const dLat = ((c2.lat - c1.lat) * Math.PI) / 180;
  const dLon = ((c2.lng - c1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((c1.lat * Math.PI) / 180) *
      Math.cos((c2.lat * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function permute(arr) {
  if (arr.length === 0) return [[]];
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = arr.slice(0, i).concat(arr.slice(i + 1));
    const remainingPerms = permute(remaining);
    for (let j = 0; j < remainingPerms.length; j++) {
      result.push([current].concat(remainingPerms[j]));
    }
  }
  return result;
}

export default function App() {
  // Theme State
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('cw_theme');
    return saved ? saved : 'dark';
  });

  // Apply theme class to documentRoot
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('cw_theme', theme);
  }, [theme]);

  // Load State from LocalStorage
  const [places, setPlaces] = useState(() => {
    const saved = localStorage.getItem('cw_places');
    return saved ? JSON.parse(saved) : SEED_PLACES;
  });

  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('cw_schedules_v2');
    return saved ? JSON.parse(saved) : SEED_SCHEDULES;
  });

  const [startTimes, setStartTimes] = useState(() => {
    const saved = localStorage.getItem('cw_start_times');
    return saved ? JSON.parse(saved) : SEED_START_TIMES;
  });

  // App Modes and Selections
  const [activeMode, setActiveMode] = useState('schedule');
  const [activeDay, setActiveDay] = useState('monday');
  const [sandboxPoints, setSandboxPoints] = useState([]);

  // Calculated Route Details
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Computed timeline items
  const [timeline, setTimeline] = useState([]);

  // Cache for routing coordinates
  const routeCacheRef = useRef({});

  // Workday commute stats (Monday - Friday)
  const [weeklyStats, setWeeklyStats] = useState({
    monday: { distance: 0, duration: 0 },
    tuesday: { distance: 0, duration: 0 },
    wednesday: { distance: 0, duration: 0 },
    thursday: { distance: 0, duration: 0 },
    friday: { distance: 0, duration: 0 }
  });

  // Toast System
  const [toast, setToast] = useState({ message: '', type: 'info', visible: false });

  // Sync to LocalStorage
  useEffect(() => {
    localStorage.setItem('cw_places', JSON.stringify(places));
  }, [places]);

  useEffect(() => {
    localStorage.setItem('cw_schedules_v2', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    localStorage.setItem('cw_start_times', JSON.stringify(startTimes));
  }, [startTimes]);

  const showToast = (message, type = 'info') => {
    setToast({ message, type, visible: true });
  };

  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast((prev) => ({ ...prev, visible: false }));
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

  // Handlers
  const handleAddPlace = (newPlace) => {
    setPlaces((prev) => {
      let updated = prev;
      if (newPlace.type === 'home') {
        updated = prev.map((p) => (p.type === 'home' ? { ...p, type: 'other' } : p));
        showToast('Demoted previous Home to normal place.', 'info');
      } else if (newPlace.type === 'office') {
        updated = prev.map((p) => (p.type === 'office' ? { ...p, type: 'other' } : p));
        showToast('Demoted previous Office to normal place.', 'info');
      }
      
      const place = {
        ...newPlace,
        id: 'p-' + Math.random().toString(36).substring(2, 9),
      };
      return [...updated, place];
    });
  };

  const handleUpdatePlace = (placeId, updatedFields) => {
    setPlaces((prev) => {
      let updated = prev;
      if (updatedFields.type === 'home') {
        updated = prev.map((p) => (p.type === 'home' && p.id !== placeId ? { ...p, type: 'other' } : p));
        showToast('Demoted previous Home to normal place.', 'info');
      } else if (updatedFields.type === 'office') {
        updated = prev.map((p) => (p.type === 'office' && p.id !== placeId ? { ...p, type: 'other' } : p));
        showToast('Demoted previous Office to normal place.', 'info');
      }
      return updated.map((p) => (p.id === placeId ? { ...p, ...updatedFields } : p));
    });
    showToast(`Updated "${updatedFields.name}"`, 'success');
  };

  const handleDeletePlace = (placeId) => {
    setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    setSandboxPoints((prev) => prev.filter((id) => id !== placeId));
    setSchedules((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((day) => {
        updated[day] = updated[day].filter((stop) => stop.placeId !== placeId);
      });
      return updated;
    });
  };

  const handleAddStopToActiveDay = (place) => {
    const defaultStay = place.type === 'office' ? 480 : place.type === 'home' ? 60 : 30;
    
    const newStop = {
      id: 'stop-' + Math.random().toString(36).substring(2, 9),
      placeId: place.id,
      stayDuration: defaultStay,
    };

    setSchedules((prev) => {
      const currentDaySchedule = prev[activeDay] || [];
      showToast(`Added "${place.name}" to ${activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}`, 'success');
      return {
        ...prev,
        [activeDay]: [...currentDaySchedule, newStop],
      };
    });
  };

  const handleRemoveStopFromActiveDay = (stopId) => {
    setSchedules((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].filter((stop) => stop.id !== stopId),
    }));
  };

  const handleUpdateStayDuration = (stopId, durationMinutes) => {
    setSchedules((prev) => ({
      ...prev,
      [activeDay]: prev[activeDay].map((stop) =>
        stop.id === stopId ? { ...stop, stayDuration: Math.max(0, parseInt(durationMinutes) || 0) } : stop
      ),
    }));
  };

  const handleUpdateStartTime = (timeStr) => {
    setStartTimes((prev) => ({
      ...prev,
      [activeDay]: timeStr,
    }));
  };

  const handleReorderStop = (index, targetIndex) => {
    const list = [...schedules[activeDay]];
    if (targetIndex < 0 || targetIndex >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIndex];
    list[targetIndex] = temp;

    setSchedules((prev) => ({
      ...prev,
      [activeDay]: list,
    }));
  };

  const handleMoveStop = (fromIndex, toIndex) => {
    const list = [...schedules[activeDay]];
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) return;
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    setSchedules((prev) => ({
      ...prev,
      [activeDay]: list,
    }));
  };

  const handleCopySchedule = (fromDay, toDay) => {
    const sourceStops = schedules[fromDay] || [];
    if (sourceStops.length === 0) {
      showToast(`${fromDay.charAt(0).toUpperCase() + fromDay.slice(1)} has an empty schedule to copy.`, 'error');
      return;
    }

    setSchedules((prev) => {
      const duplicatedStops = sourceStops.map((stop) => ({
        ...stop,
        id: 'stop-' + Math.random().toString(36).substring(2, 9),
      }));
      return {
        ...prev,
        [toDay]: duplicatedStops,
      };
    });

    setStartTimes((prev) => {
      const sourceTime = prev[fromDay] || '08:00';
      return {
        ...prev,
        [toDay]: sourceTime,
      };
    });

    showToast(`Copied ${fromDay.charAt(0).toUpperCase() + fromDay.slice(1)}'s schedule to ${toDay.charAt(0).toUpperCase() + toDay.slice(1)}!`, 'success');
  };

  const handleOptimizeRoute = () => {
    const dayStops = schedules[activeDay] || [];
    const homePlace = places.find((p) => p.type === 'home');

    if (!homePlace) {
      showToast('Verify Home location is set to optimize route.', 'error');
      return;
    }

    // Optimize all intermediate destinations (including any intermediate Home stops)
    const intermediateStops = dayStops;

    if (intermediateStops.length < 2) {
      showToast('Need at least 2 destinations to optimize.', 'error');
      return;
    }

    const permutations = permute(intermediateStops);
    let bestPerm = intermediateStops;
    let minDistance = Infinity;

    permutations.forEach((perm) => {
      let totalDist = 0;
      const firstPlace = places.find((p) => p.id === perm[0].placeId);
      if (firstPlace) {
        totalDist += haversineDistance(homePlace, firstPlace);
      }

      for (let i = 0; i < perm.length - 1; i++) {
        const p1 = places.find((p) => p.id === perm[i].placeId);
        const p2 = places.find((p) => p.id === perm[i + 1].placeId);
        if (p1 && p2) {
          totalDist += haversineDistance(p1, p2);
        }
      }

      const lastPlace = places.find((p) => p.id === perm[perm.length - 1].placeId);
      if (lastPlace) {
        totalDist += haversineDistance(lastPlace, homePlace);
      }

      if (totalDist < minDistance) {
        minDistance = totalDist;
        bestPerm = perm;
      }
    });

    setSchedules((prev) => ({
      ...prev,
      [activeDay]: bestPerm,
    }));

    showToast('Route order optimized around Home!', 'success');
  };

  const handleToggleSandboxPoint = (placeId) => {
    setSandboxPoints((prev) => {
      if (prev.includes(placeId)) {
        showToast('Location removed from sandbox', 'info');
        return prev.filter((id) => id !== placeId);
      } else {
        const place = places.find((p) => p.id === placeId);
        showToast(`Selected "${place?.name}" for sandbox route`, 'success');
        return [...prev, placeId];
      }
    });
  };

  const handleClearSandbox = () => {
    setSandboxPoints([]);
    showToast('Sandbox cleared', 'info');
  };

  // Export JSON configuration file
  const handleExportConfig = () => {
    const config = {
      version: '1.0',
      places,
      schedules,
      startTimes,
      theme,
    };
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(config, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', 'routeen_config.json');
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast('Configuration exported!', 'success');
  };

  // Import JSON configuration file
  const handleImportConfig = (config) => {
    if (config.places) setPlaces(config.places);
    if (config.schedules) setSchedules(config.schedules);
    if (config.startTimes) setStartTimes(config.startTimes);
    if (config.theme) setTheme(config.theme);
  };

  // Route calculation
  useEffect(() => {
    let activeCoordinates = [];
    let routeStops = [];

    if (activeMode === 'schedule') {
      const dayStops = schedules[activeDay] || [];
      const homePlace = places.find((p) => p.type === 'home');

      if (dayStops.length === 0) {
        // Reset route/timeline state for an empty day. This is an async route-calc
        // effect (debounced fetch + cleanup below), so these synchronous resets are
        // intentional, not the derived-state-in-effect anti-pattern.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setRouteGeometry(null);
        setRouteDetails(null);
        if (homePlace) {
          const startTimeStr = startTimes[activeDay] || '08:00';
          const [startH, startM] = startTimeStr.split(':').map(Number);
          const currentMinutes = startH * 60 + startM;
          setTimeline([
            {
              stopId: 'home-start',
              placeName: homePlace.name,
              placeType: homePlace.type,
              lat: homePlace.lat,
              lng: homePlace.lng,
              address: homePlace.address,
              arrivalMinutes: currentMinutes,
              departureMinutes: currentMinutes,
              stayDuration: 0,
              driveToNextMinutes: 0,
              driveToNextMiles: 0,
              isFirst: true,
              isLast: false,
              isHomeStart: true,
              isHomeEnd: false,
            },
            {
              stopId: 'home-end',
              placeName: homePlace.name,
              placeType: homePlace.type,
              lat: homePlace.lat,
              lng: homePlace.lng,
              address: homePlace.address,
              arrivalMinutes: currentMinutes,
              departureMinutes: currentMinutes,
              stayDuration: 0,
              driveToNextMinutes: 0,
              driveToNextMiles: 0,
              isFirst: false,
              isLast: true,
              isHomeStart: false,
              isHomeEnd: true,
            },
          ]);
        } else {
          setTimeline([]);
        }
        return;
      }

      if (homePlace) {
        routeStops.push({ id: 'home-start', placeId: homePlace.id, stayDuration: 0, isHomeStart: true });
      }

      dayStops.forEach((stop) => {
        routeStops.push(stop);
      });

      if (homePlace) {
        routeStops.push({ id: 'home-end', placeId: homePlace.id, stayDuration: 0, isHomeEnd: true });
      }

      activeCoordinates = routeStops
        .map((stop) => {
          const place = places.find((p) => p.id === stop.placeId);
          return place ? { lat: place.lat, lng: place.lng } : null;
        })
        .filter(Boolean);
    } else {
      activeCoordinates = sandboxPoints
        .map((placeId) => {
          const place = places.find((p) => p.id === placeId);
          return place ? { lat: place.lat, lng: place.lng } : null;
        })
        .filter(Boolean);
    }

    if (activeCoordinates.length < 2) {
      setRouteGeometry(null);
      setRouteDetails(null);
      setTimeline([]);
      return;
    }

    let isSubscribed = true;
    const fetchRouteData = async () => {
      setRouteLoading(true);
      try {
        const key = activeCoordinates.map((c) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`).join(';');
        let route;
        if (routeCacheRef.current[key]) {
          route = routeCacheRef.current[key];
        } else {
          route = await getRoute(activeCoordinates);
          if (route) {
            routeCacheRef.current[key] = route;
          }
        }

        if (isSubscribed && route) {
          setRouteGeometry(route.geometry);
          setRouteDetails({
            distance: route.distance,
            duration: route.duration,
            steps: route.steps,
            legs: route.raw.legs || [],
          });

          if (activeMode === 'schedule') {
            const startTimeStr = startTimes[activeDay] || '08:00';
            const [startH, startM] = startTimeStr.split(':').map(Number);
            let currentMinutes = startH * 60 + startM;

            const computedTimeline = [];

            routeStops.forEach((stop, index) => {
              const place = places.find((p) => p.id === stop.placeId);
              if (!place) return;

              let arrivalMinutes = currentMinutes;
              let driveToNextMinutes = 0;
              let driveToNextMiles = 0;

              const isFirst = index === 0;
              const isLast = index === routeStops.length - 1;
              let departureMinutes = arrivalMinutes + (stop.stayDuration || 0);

              if (!isLast && route.raw.legs && route.raw.legs[index]) {
                const leg = route.raw.legs[index];
                driveToNextMinutes = leg.duration / 60;
                driveToNextMiles = leg.distance * 0.000621371;
                currentMinutes = departureMinutes + driveToNextMinutes;
              }

              computedTimeline.push({
                stopId: stop.id,
                placeName: place.name,
                placeType: place.type,
                lat: place.lat,
                lng: place.lng,
                address: place.address,
                arrivalMinutes,
                departureMinutes,
                stayDuration: stop.stayDuration,
                driveToNextMinutes,
                driveToNextMiles,
                isFirst,
                isLast,
                isHomeStart: stop.isHomeStart,
                isHomeEnd: stop.isHomeEnd,
              });
            });

            setTimeline(computedTimeline);
          }
        }
      } catch (err) {
        if (isSubscribed) {
          console.error(err);
          showToast('Failed to calculate driving route.', 'error');
          setRouteGeometry(null);
          setRouteDetails(null);
          setTimeline([]);
        }
      } finally {
        if (isSubscribed) {
          setRouteLoading(false);
        }
      }
    };

    const delayTimer = setTimeout(() => {
      fetchRouteData();
    }, 350);

    return () => {
      isSubscribed = false;
      clearTimeout(delayTimer);
    };
  }, [activeMode, activeDay, schedules, startTimes, sandboxPoints, places]);

  // Calculate background stats for all workday schedules (Monday - Friday) for projections
  useEffect(() => {
    let isSubscribed = true;
    
    const calculateAllStats = async () => {
      const workdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
      const statsUpdates = {};

      const promises = workdays.map(async (day) => {
        const dayStops = schedules[day] || [];
        const homePlace = places.find((p) => p.type === 'home');

        if (dayStops.length === 0) {
          statsUpdates[day] = { distance: 0, duration: 0 };
          return;
        }

        const routeStops = [];
        if (homePlace) {
          routeStops.push({ placeId: homePlace.id });
        }
        dayStops.forEach((stop) => {
          routeStops.push(stop);
        });
        if (homePlace) {
          routeStops.push({ placeId: homePlace.id });
        }

        const coordinates = routeStops
          .map((stop) => {
            const place = places.find((p) => p.id === stop.placeId);
            return place ? { lat: place.lat, lng: place.lng } : null;
          })
          .filter(Boolean);

        if (coordinates.length < 2) {
          statsUpdates[day] = { distance: 0, duration: 0 };
          return;
        }

        const key = coordinates.map((c) => `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`).join(';');
        
        if (routeCacheRef.current[key]) {
          const cached = routeCacheRef.current[key];
          statsUpdates[day] = { distance: cached.distance, duration: cached.duration };
        } else {
          try {
            const result = await getRoute(coordinates);
            if (result) {
              routeCacheRef.current[key] = result;
              statsUpdates[day] = { distance: result.distance, duration: result.duration };
            } else {
              statsUpdates[day] = { distance: 0, duration: 0 };
            }
          } catch (err) {
            console.error(`Error calculating background route for ${day}:`, err);
            statsUpdates[day] = { distance: 0, duration: 0 };
          }
        }
      });

      await Promise.all(promises);

      if (isSubscribed) {
        setWeeklyStats((prev) => {
          const changed = workdays.some(
            (day) =>
              prev[day].distance !== statsUpdates[day].distance ||
              prev[day].duration !== statsUpdates[day].duration
          );
          return changed ? { ...prev, ...statsUpdates } : prev;
        });
      }
    };

    const timer = setTimeout(() => {
      calculateAllStats();
    }, 400);

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
    };
  }, [schedules, places]);

  return (
    <div className="dashboard-container">
      {/* Toast Notification */}
      {toast.visible && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            <span style={{ fontSize: '15px' }}>
              {toast.type === 'success' ? '✅' : toast.type === 'error' ? '❌' : 'ℹ️'}
            </span>
            {toast.message}
          </div>
        </div>
      )}

      {/* Sidebar Panel */}
      <Sidebar
        places={places}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        activeDay={activeDay}
        setActiveDay={setActiveDay}
        activeDaySchedule={schedules[activeDay] || []}
        schedules={schedules}
        weeklyStats={weeklyStats}
        sandboxPoints={sandboxPoints}
        onAddPlace={handleAddPlace}
        onUpdatePlace={handleUpdatePlace}
        onDeletePlace={handleDeletePlace}
        onAddStopToActiveDay={handleAddStopToActiveDay}
        onRemoveStopFromActiveDay={handleRemoveStopFromActiveDay}
        onUpdateStayDuration={handleUpdateStayDuration}
        startTime={startTimes[activeDay]}
        onUpdateStartTime={handleUpdateStartTime}
        onReorderStop={handleReorderStop}
        onMoveStop={handleMoveStop}
        onOptimizeRoute={handleOptimizeRoute}
        onCopySchedule={handleCopySchedule}
        onToggleSandboxPoint={handleToggleSandboxPoint}
        onClearSandbox={handleClearSandbox}
        activeRouteDetails={routeDetails}
        timeline={timeline}
        theme={theme}
        onToggleTheme={() => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onExportConfig={handleExportConfig}
        onImportConfig={handleImportConfig}
        onShowToast={showToast}
      />

      {/* Map Content Viewport */}
      <MapContainer
        places={places}
        activeMode={activeMode}
        sandboxPoints={sandboxPoints}
        activeDaySchedule={schedules[activeDay] || []}
        timeline={timeline}
        activeRouteGeometry={routeGeometry}
        activeRouteLoading={routeLoading}
        onAddPlace={handleAddPlace}
        onToggleSandboxPoint={handleToggleSandboxPoint}
        onAddStopToActiveDay={handleAddStopToActiveDay}
        theme={theme}
      />

      {/* Dynamic Floating HUD Cards */}
      <div className="map-overlay">
        {activeMode === 'schedule' && timeline.length >= 2 && routeDetails && (
          <div className="map-card-widget">
            <h3>{activeDay.toUpperCase()} STATS</h3>
            <div className="main-value">{routeDetails.distance.toFixed(1)} miles</div>
            <div className="sub-value">
              ⏱️ Est. Driving:{' '}
              {routeDetails.duration < 60
                ? `${Math.round(routeDetails.duration)} mins`
                : `${Math.floor(routeDetails.duration / 60)}h ${Math.round(
                    routeDetails.duration % 60
                  )}m`}
            </div>
            {timeline.length > 0 && (
              <div className="sub-value" style={{ borderTop: '1px solid var(--border-color)', marginTop: 4, paddingTop: 4 }}>
                🏠 Day Duration:{' '}
                {(() => {
                  const first = timeline[0];
                  const last = timeline[timeline.length - 1];
                  const totalMinutes = last.arrivalMinutes - first.departureMinutes;
                  if (isNaN(totalMinutes)) return '--';
                  const hrs = Math.floor(totalMinutes / 60);
                  const mins = Math.round(totalMinutes % 60);
                  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins} mins`;
                })()}
              </div>
            )}
            <div className="sub-value">📍 Stops: {schedules[activeDay].length}</div>
          </div>
        )}

        {activeMode === 'sandbox' && sandboxPoints.length >= 2 && routeDetails && (
          <div className="map-card-widget" style={{ borderLeft: '4px solid var(--info)' }}>
            <h3 style={{ color: 'var(--info)' }}>SANDBOX ROUTE</h3>
            <div className="main-value" style={{ color: 'var(--info)' }}>
              {routeDetails.distance.toFixed(1)} miles
            </div>
            <div className="sub-value">
              ⏱️ Est. Driving:{' '}
              {routeDetails.duration < 60
                ? `${Math.round(routeDetails.duration)} mins`
                : `${Math.floor(routeDetails.duration / 60)}h ${Math.round(
                    routeDetails.duration % 60
                  )}m`}
            </div>
            <div className="sub-value">📍 Points Selected: {sandboxPoints.length}</div>
          </div>
        )}
      </div>
    </div>
  );
}
