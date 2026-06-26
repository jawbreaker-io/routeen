import { useState, useEffect, useRef } from 'react';
import {
  CheckCircle,
  WarningCircle,
  Info,
  Sun,
  Moon,
  ChartBar,
} from '@phosphor-icons/react';
import Sidebar from './components/Sidebar';
import MapContainer from './components/MapContainer';
import DashboardModal from './components/DashboardModal';
import { DAY_KEYS, createDayMap, getDayLabel, getDefaultStartTime } from './constants/days';
import { getRoute } from './services/mapService';

const SEED_PLACES = [
  { id: 'p1', name: 'Home', type: 'home', address: '100 Pine St, San Francisco, CA 94111', lat: 37.7925, lng: -122.3999 },
  { id: 'p2', name: 'Salesforce Office', type: 'office', address: '415 Mission St, San Francisco, CA 94105', lat: 37.7897, lng: -122.3972 },
  { id: 'p3', name: 'City Gym', type: 'exercise', address: '201 Berry St, San Francisco, CA 94158', lat: 37.7765, lng: -122.3934 },
  { id: 'p4', name: 'Whole Foods Market', type: 'shopping', address: '2300 16th St, San Francisco, CA 94103', lat: 37.7663, lng: -122.4093 }
];

const MONDAY_SEED_STOPS = [
  { id: 's1', placeId: 'p1', stayDuration: 0 },
  { id: 's2', placeId: 'p2', stayDuration: 480 },
  { id: 's3', placeId: 'p3', stayDuration: 60 },
  { id: 's4', placeId: 'p4', stayDuration: 30 },
  { id: 's5', placeId: 'p1', stayDuration: 0 },
];

const createEmptySchedules = () => createDayMap(() => []);
const createSeedSchedules = () => ({
  ...createEmptySchedules(),
  monday: MONDAY_SEED_STOPS.map((stop) => ({ ...stop })),
});

const createSeedStartTimes = () => createDayMap((day) => day.defaultStartTime);
const createEmptyWeeklyStats = () => createDayMap(() => ({ distance: 0, duration: 0 }));
const MOBILE_SHEET_STATES = ['peek', 'half', 'full'];

function formatRouteDuration(minutes) {
  if (!Number.isFinite(minutes)) return null;
  if (minutes < 60) return `${Math.round(minutes)} min`;

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function normalizeSchedules(value, fallbackFactory = createEmptySchedules) {
  const source = value && typeof value === 'object' ? value : {};
  const fallback = fallbackFactory();
  return createDayMap((day) => {
    const daySchedule = source[day.key];
    return Array.isArray(daySchedule) ? daySchedule : fallback[day.key];
  });
}

function normalizeStartTimes(value) {
  const source = value && typeof value === 'object' ? value : {};
  return createDayMap((day) =>
    typeof source[day.key] === 'string' && source[day.key] ? source[day.key] : day.defaultStartTime
  );
}

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
  // Theme State (candy brand is light-first)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('cw_theme');
    return saved ? saved : 'light';
  });

  // Apply the candy theme via data-rt-theme on the document root.
  useEffect(() => {
    document.documentElement.setAttribute('data-rt-theme', theme);
    localStorage.setItem('cw_theme', theme);
  }, [theme]);

  // Load State from LocalStorage
  const [places, setPlaces] = useState(() => {
    const saved = localStorage.getItem('cw_places');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        let migrated = false;
        const updated = parsed.map((p) => {
          if (p.name === 'City Gym' && p.type === 'other') {
            migrated = true;
            return { ...p, type: 'exercise' };
          }
          if (p.name === 'Whole Foods Market' && p.type === 'other') {
            migrated = true;
            return { ...p, type: 'shopping' };
          }
          return p;
        });
        if (migrated) {
          localStorage.setItem('cw_places', JSON.stringify(updated));
        }
        return updated;
      } catch {
        return SEED_PLACES;
      }
    }
    return SEED_PLACES;
  });

  const [schedules, setSchedules] = useState(() => {
    const saved = localStorage.getItem('cw_schedules_v2');
    if (!saved) return createSeedSchedules();
    try {
      return normalizeSchedules(JSON.parse(saved));
    } catch {
      return createSeedSchedules();
    }
  });

  const [startTimes, setStartTimes] = useState(() => {
    const saved = localStorage.getItem('cw_start_times');
    if (!saved) return createSeedStartTimes();
    try {
      return normalizeStartTimes(JSON.parse(saved));
    } catch {
      return createSeedStartTimes();
    }
  });

  // App Modes and Selections
  const [activeMode, setActiveMode] = useState('schedule');
  const [activeDay, setActiveDay] = useState('monday');
  const [sandboxPoints, setSandboxPoints] = useState([]);
  const [mobileSheetState, setMobileSheetState] = useState('peek');

  // Calculated Route Details
  const [routeGeometry, setRouteGeometry] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);

  // Computed timeline items
  const [timeline, setTimeline] = useState([]);

  // Cache for routing coordinates
  const routeCacheRef = useRef({});

  const [weeklyStats, setWeeklyStats] = useState(createEmptyWeeklyStats);

  const [showDashboard, setShowDashboard] = useState(false);

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
    const defaultStay = place.type === 'office' ? 480 : (place.type === 'home' || place.type === 'exercise' || place.type === 'activities' || place.type === 'third_place' || place.type === 'eatery') ? 60 : 30;
    
    const newStop = {
      id: 'stop-' + Math.random().toString(36).substring(2, 9),
      placeId: place.id,
      stayDuration: defaultStay,
    };

    setSchedules((prev) => {
      const currentDaySchedule = prev[activeDay] || [];
      showToast(`Added "${place.name}" to ${getDayLabel(activeDay)}`, 'success');
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
      showToast(`${getDayLabel(fromDay)} has an empty schedule to copy.`, 'error');
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
      const sourceTime = prev[fromDay] || getDefaultStartTime(fromDay);
      return {
        ...prev,
        [toDay]: sourceTime,
      };
    });

    showToast(`Copied ${getDayLabel(fromDay)}'s schedule to ${getDayLabel(toDay)}!`, 'success');
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
    if (config.schedules) setSchedules(normalizeSchedules(config.schedules));
    if (config.startTimes) setStartTimes(normalizeStartTimes(config.startTimes));
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
          const startTimeStr = startTimes[activeDay] || getDefaultStartTime(activeDay);
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
            const startTimeStr = startTimes[activeDay] || getDefaultStartTime(activeDay);
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

  // Calculate background stats for every planner day.
  useEffect(() => {
    let isSubscribed = true;
    
    const calculateAllStats = async () => {
      const statsUpdates = {};

      const promises = DAY_KEYS.map(async (day) => {
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
          const changed = DAY_KEYS.some(
            (day) =>
              (prev[day]?.distance || 0) !== statsUpdates[day].distance ||
              (prev[day]?.duration || 0) !== statsUpdates[day].duration
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

  const handleCycleMobileSheet = () => {
    setMobileSheetState((currentState) => {
      const currentIndex = MOBILE_SHEET_STATES.indexOf(currentState);
      return MOBILE_SHEET_STATES[(currentIndex + 1) % MOBILE_SHEET_STATES.length];
    });
  };

  const mobileSheetSummary = (() => {
    const activeCount =
      activeMode === 'schedule' ? (schedules[activeDay] || []).length : sandboxPoints.length;
    const countLabel =
      activeMode === 'schedule'
        ? `${activeCount} stop${activeCount === 1 ? '' : 's'}`
        : `${activeCount} point${activeCount === 1 ? '' : 's'}`;
    const title =
      activeMode === 'schedule' ? `${getDayLabel(activeDay)} planner` : 'Route sandbox';
    const routeMetrics = routeDetails
      ? [`${routeDetails.distance.toFixed(1)} mi`, formatRouteDuration(routeDetails.duration)]
      : routeLoading
        ? ['Calculating route']
        : [];

    return {
      title,
      meta: [...routeMetrics.filter(Boolean), countLabel].join(' / '),
    };
  })();

  // Candy HUD (top-left map card) values
  const isScheduleMode = activeMode === 'schedule';
  const hudHasRoute =
    !!routeDetails &&
    ((isScheduleMode && timeline.length >= 2) ||
      (!isScheduleMode && sandboxPoints.length >= 2));
  const hudTitle = isScheduleMode
    ? `${getDayLabel(activeDay)} route`
    : 'sandbox route';
  const hudDistance = hudHasRoute ? routeDetails.distance.toFixed(1) : '0.0';
  const hudDuration = hudHasRoute ? formatRouteDuration(routeDetails.duration) : '--';
  const hudStops = isScheduleMode
    ? (schedules[activeDay] || []).length
    : sandboxPoints.length;
  let hudDayLength = '--';
  if (isScheduleMode && timeline.length >= 2) {
    const total =
      timeline[timeline.length - 1].arrivalMinutes - timeline[0].departureMinutes;
    if (Number.isFinite(total)) hudDayLength = formatRouteDuration(total) || '0 min';
  }
  const themeIcon =
    theme === 'dark' ? <Sun size={16} weight="fill" /> : <Moon size={16} weight="fill" />;
  const handleToggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <div className={`dashboard-container mobile-sheet-${mobileSheetState}`}>
      {/* Toast Notification */}
      {toast.visible && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? (
              <CheckCircle size={17} weight="fill" />
            ) : toast.type === 'error' ? (
              <WarningCircle size={17} weight="fill" />
            ) : (
              <Info size={17} weight="fill" />
            )}
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
        onToggleTheme={handleToggleTheme}
        onExportConfig={handleExportConfig}
        onImportConfig={handleImportConfig}
        onShowToast={showToast}
        onOpenDashboard={() => setShowDashboard(true)}
        mobileSheetState={mobileSheetState}
        onMobileSheetStateChange={setMobileSheetState}
        onCycleMobileSheet={handleCycleMobileSheet}
        mobileSheetSummary={mobileSheetSummary}
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
        hud={{
          title: hudTitle,
          distance: hudDistance,
          duration: hudDuration,
          dayLength: hudDayLength,
          stops: hudStops,
        }}
      />

      {/* Mobile floating cyan top bar */}
      <div className="rt-topbar">
        <span className="jb-mark jb-mark--sm" style={{ width: 30, height: 30 }} />
        <span className="rt-topbar-name">routeen</span>
        <button
          type="button"
          className="header-round-btn"
          onClick={handleToggleTheme}
          title="Toggle light / dark"
        >
          {themeIcon}
        </button>
        <button
          type="button"
          className="header-round-btn"
          onClick={() => setShowDashboard(true)}
          title="Weekly insights"
        >
          <ChartBar size={16} weight="bold" />
        </button>
      </div>


      {/* Analytics Insights Dashboard Modal */}
      <DashboardModal
        isOpen={showDashboard}
        onClose={() => setShowDashboard(false)}
        places={places}
        schedules={schedules}
        weeklyStats={weeklyStats}
      />
    </div>
  );
}
