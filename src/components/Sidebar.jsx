import { useState, useEffect, useRef } from 'react';
import {
  Home as HomeIcon,
  Building2,
  MapPin,
  Plus,
  Trash2,
  Edit,
  ArrowUp,
  ArrowDown,
  Route,
  Calendar,
  ChevronDown,
  ChevronUp,
  Search,
  Clock,
  Compass,
  Navigation,
  Sparkles,
  Copy,
  Sun,
  Moon,
  X,
  Settings,
  Download,
  Upload,
  GripVertical,
} from 'lucide-react';
import { geocodeAddress } from '../services/mapService';
// Helper to format minutes to standard AM/PM time
const formatTime = (minutes) => {
  if (isNaN(minutes)) return '--:--';
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
};

// Subcomponent for each timeline item to prevent input jumping/cursor issues
function TimelineStopCard({
  stop,
  index,
  isFixed,
  scheduleIndex,
  activeDaySchedule,
  timeline,
  onReorderStop,
  onRemoveStopFromActiveDay,
  onUpdateStayDuration,
  draggedIndex,
  dragOverIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleDrop,
}) {
  const [localHours, setLocalHours] = useState((stop.stayDuration / 60).toString());

  // Sync local input when the duration changes externally (e.g. from config import).
  // Done during render via a stored previous value rather than in an effect, which
  // avoids the extra commit/cascading render that a setState-in-effect would cause.
  const [prevStayDuration, setPrevStayDuration] = useState(stop.stayDuration);
  if (stop.stayDuration !== prevStayDuration) {
    setPrevStayDuration(stop.stayDuration);
    setLocalHours((stop.stayDuration / 60).toString());
  }

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalHours(val);
    const hours = parseFloat(val);
    if (!isNaN(hours)) {
      onUpdateStayDuration(stop.stopId, Math.round(hours * 60));
    } else {
      onUpdateStayDuration(stop.stopId, 0);
    }
  };

  const handleBlur = () => {
    const hours = parseFloat(localHours) || 0;
    setLocalHours(hours.toString());
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* Stop Card */}
      <div
        className={`stop-card ${!isFixed ? 'draggable' : ''} ${!isFixed && draggedIndex === scheduleIndex ? 'is-dragging' : ''} ${!isFixed && dragOverIndex === scheduleIndex ? 'drag-over' : ''}`}
        draggable={!isFixed}
        onDragStart={!isFixed ? (e) => handleDragStart(e, scheduleIndex) : undefined}
        onDragOver={!isFixed ? (e) => handleDragOver(e, scheduleIndex) : undefined}
        onDragEnd={!isFixed ? handleDragEnd : undefined}
        onDrop={!isFixed ? (e) => handleDrop(e, scheduleIndex) : undefined}
        style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'stretch', 
          gap: '6px',
          borderLeft: isFixed ? '3px solid var(--success)' : ''
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="stop-card-left">
            {!isFixed && (
              <div className="grip-handle" title="Drag to reorder stop">
                <GripVertical size={14} />
              </div>
            )}
            <div className="stop-number" style={{ 
              background: isFixed ? 'var(--success-glow)' : '', 
              color: isFixed ? 'var(--success)' : '' 
            }}>
              {isFixed ? '🏠' : index}
            </div>
            <div className={`stop-type-dot ${stop.placeType}`} title={stop.placeType} />
            <div className="stop-name" title={stop.placeName} style={{ fontSize: '13.5px', fontWeight: isFixed ? '600' : 'normal' }}>
              {stop.placeName} {isFixed && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>({stop.isHomeStart ? 'Start' : 'End'})</span>}
            </div>
          </div>

          {!isFixed && (
            <div className="stop-actions">
              <button
                type="button"
                className="stop-btn-arrow"
                onClick={() => onReorderStop(scheduleIndex, scheduleIndex - 1)}
                disabled={scheduleIndex === 0}
                title="Move Up"
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                className="stop-btn-arrow"
                onClick={() => onReorderStop(scheduleIndex, scheduleIndex + 1)}
                disabled={scheduleIndex === activeDaySchedule.length - 1}
                title="Move Down"
              >
                <ArrowDown size={12} />
              </button>
              <button
                type="button"
                className="stop-btn-arrow"
                onClick={() => onRemoveStopFromActiveDay(stop.stopId)}
                style={{ color: 'var(--danger)' }}
                title="Remove stop"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Time & Stay Info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-primary)',
          padding: '6px 8px',
          borderRadius: '6px',
          fontSize: '11px',
          border: '1px solid var(--border-color)',
          marginTop: '2px'
        }}>
          <div style={{ color: 'var(--text-secondary)', display: 'flex', gap: '4px' }}>
            {stop.isFirst ? (
              <span>📤 Leave: <strong>{formatTime(stop.departureMinutes)}</strong></span>
            ) : stop.isLast ? (
              <span>📥 Arrive: <strong>{formatTime(stop.arrivalMinutes)}</strong></span>
            ) : (
              <span>
                📥 <strong>{formatTime(stop.arrivalMinutes)}</strong>
                {' '}→{' '}
                📤 <strong>{formatTime(stop.departureMinutes)}</strong>
              </span>
            )}
          </div>

          {!stop.isLast && !isFixed && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Stay:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={localHours}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  style={{
                    width: '60px',
                    padding: '3px 6px',
                    fontSize: '12px',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)',
                    height: '24px',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    textAlign: 'center',
                  }}
                  title="Stay duration in hours (0.5h step)"
                />
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>h</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* If no intermediate stops, render a dashed placeholder between start & end Home */}
      {stop.isHomeStart && timeline[index + 1]?.isHomeEnd && (
        <div style={{
          paddingLeft: '22px',
          margin: '8px 0',
          borderLeft: '2px dashed var(--border-color)',
          marginLeft: '21px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{
            border: '1.5px dashed var(--border-color)',
            borderRadius: '8px',
            padding: '16px',
            textAlign: 'center',
            background: 'rgba(255, 255, 255, 0.015)',
            fontSize: '11.5px',
            color: 'var(--text-muted)'
          }}>
            📍 Add destinations above or click on the map to build your commute route.
          </div>
        </div>
      )}

      {/* Travel Connection details */}
      {!stop.isLast && stop.driveToNextMinutes > 0 && (
        <div style={{
          paddingLeft: '22px',
          margin: '4px 0',
          borderLeft: '2px dashed var(--border-color)',
          marginLeft: '21px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-secondary)',
          fontSize: '11px'
        }}>
          <span>🚗</span>
          <span>
            Drive <strong>{Math.round(stop.driveToNextMinutes)} mins</strong>
            {' '}({stop.driveToNextMiles.toFixed(1)} mi)
          </span>
        </div>
      )}
    </div>
  );
}

export default function Sidebar({
  places,
  activeMode,
  setActiveMode,
  activeDay,
  setActiveDay,
  activeDaySchedule,
  sandboxPoints,
  onAddPlace,
  onUpdatePlace,
  onDeletePlace,
  onAddStopToActiveDay,
  onRemoveStopFromActiveDay,
  onUpdateStayDuration,
  startTime,
  onUpdateStartTime,
  onReorderStop,
  onMoveStop,
  onOptimizeRoute,
  onCopySchedule,
  schedules,
  weeklyStats,
  onToggleSandboxPoint,
  onClearSandbox,
  activeRouteDetails,
  timeline,
  theme,
  onToggleTheme,
  onExportConfig,
  onImportConfig,
  onShowToast,
}) {
  // Add/Edit Place Form State
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeType, setPlaceType] = useState('other');
  const [editingPlaceId, setEditingPlaceId] = useState(null); // stores ID of place being edited

  // Config Import / Export Refs & Handlers
  const fileInputRef = useRef(null);

  // Drag and Drop State & Handlers
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    if (dragOverIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDrop = (e, targetIndex) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== targetIndex) {
      onMoveStop(draggedIndex, targetIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        
        // Validation
        if (!config || typeof config !== 'object') {
          throw new Error('Configuration must be a JSON object.');
        }
        if (!config.places || !Array.isArray(config.places)) {
          throw new Error('Configuration missing a valid "places" array.');
        }
        if (!config.schedules || typeof config.schedules !== 'object') {
          throw new Error('Configuration missing a valid "schedules" object.');
        }

        // Validate structure inside places
        const isValidPlaces = config.places.every(
          (p) => p && typeof p === 'object' && p.id && p.name && p.type && typeof p.lat === 'number' && typeof p.lng === 'number'
        );
        if (!isValidPlaces) {
          throw new Error('Some places in configuration have invalid/missing properties (name, lat, lng, type, id).');
        }

        // Call parent handler
        onImportConfig(config);
        onShowToast('Configuration imported successfully!', 'success');
      } catch (err) {
        onShowToast('Import failed: ' + err.message, 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };
  
  // Set limit to local to true by default if there is a Home address saved
  const [limitToLocal, setLimitToLocal] = useState(() => {
    return places.some((p) => p.type === 'home');
  });
  
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedCoords, setSelectedCoords] = useState(null);

  // Directions Expand State
  const [showDirections, setShowDirections] = useState(false);

  // Find if Home location exists
  const homePlace = places.find((p) => p.type === 'home');
  const hasHome = !!homePlace;
  const prevHasHomeRef = useRef(hasHome);

  // Auto-manage local limit checkbox when Home location status changes
  useEffect(() => {
    if (hasHome && !prevHasHomeRef.current) {
      setLimitToLocal(true);
    } else if (!hasHome && prevHasHomeRef.current) {
      setLimitToLocal(false);
    }
    prevHasHomeRef.current = hasHome;
  }, [hasHome]);

  // Calculate 50-mile bounds if enabled and Home exists
  const getBounds = () => {
    if (!limitToLocal || !homePlace) return null;
    const lat = homePlace.lat;
    const lng = homePlace.lng;
    
    const latDelta = 50 / 69.0;
    const lngDelta = 50 / (69.0 * Math.cos((lat * Math.PI) / 180));

    return {
      minLng: lng - lngDelta,
      maxLat: lat + latDelta,
      maxLng: lng + lngDelta,
      minLat: lat - latDelta,
    };
  };

  // Debounced Address Typeahead Lookup
  useEffect(() => {
    if (placeAddress.trim().length < 4 || selectedCoords) {
      // Clear stale suggestions immediately when the query is too short or a result
      // was picked. This is intentional reset logic for an async effect, not derived
      // state, so the set-state-in-effect rule is suppressed here.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchSuggestions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const results = await geocodeAddress(placeAddress, true, getBounds());
        setSearchSuggestions(results);
      } catch (error) {
        console.error('Typeahead geocoding error:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
    // getBounds is derived from limitToLocal/places, which are already dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeAddress, selectedCoords, limitToLocal, places]);

    // formatTime helper deleted (moved to module level)

  // Google Maps directions launch
  const handleSendToGoogleMaps = () => {
    if (activeDaySchedule.length < 2) return;

    const coords = activeDaySchedule
      .map((stop) => places.find((p) => p.id === stop.placeId))
      .filter(Boolean);

    if (coords.length < 2) return;

    const origin = `${coords[0].lat},${coords[0].lng}`;
    const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`;

    const waypoints = coords
      .slice(1, -1)
      .map((c) => `${c.lat},${c.lng}`)
      .join('%7C');

    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;

    window.open(url, '_blank');
    onShowToast('Opening route directions in Google Maps!', 'success');
  };

  // Copy textual itinerary summary to clipboard
  const handleCopySummary = () => {
    if (activeDaySchedule.length === 0) return;

    let text = `CommuteWise Route - ${activeDay.toUpperCase()}\n`;
    text += `Start Time: ${startTime || '08:00'}\n`;
    if (activeRouteDetails) {
      text += `Total Distance: ${activeRouteDetails.distance.toFixed(1)} miles\n`;
      text += `Estimated Driving Time: ${Math.round(activeRouteDetails.duration)} mins\n`;
    }
    text += `-------------------------------------------\n`;

    timeline.forEach((item, index) => {
      const timeInfo = item.isFirst
        ? `Depart: ${formatTime(item.departureMinutes)}`
        : item.isLast
        ? `Arrive: ${formatTime(item.arrivalMinutes)}`
        : `Arrive: ${formatTime(item.arrivalMinutes)} | Depart: ${formatTime(item.departureMinutes)}`;

      text += `${index + 1}. ${item.placeName} (${timeInfo})\n`;
      const fullPlace = places.find((p) => p.name === item.placeName);
      if (fullPlace) {
        text += `   Address: ${fullPlace.address}\n`;
      }

      if (item.stayDuration > 0 && !item.isLast) {
        const hours = item.stayDuration / 60;
        text += `   Stay duration: ${hours} ${hours === 1 ? 'hour' : 'hours'}\n`;
      }

      if (!item.isLast && item.driveToNextMinutes > 0) {
        text += `   🚗 Drive to next: ${Math.round(item.driveToNextMinutes)} mins (${item.driveToNextMiles.toFixed(1)} miles)\n`;
      }
    });

    navigator.clipboard.writeText(text);
    onShowToast('Itinerary copied to clipboard!', 'success');
  };

  // Address Geocoding Search (manual button click)
  const handleAddressSearch = async (e) => {
    e.preventDefault();
    if (!placeAddress.trim()) {
      onShowToast('Please enter an address to search', 'error');
      return;
    }

    setSearchLoading(true);
    setSearchSuggestions([]);
    setSelectedCoords(null);

    try {
      const results = await geocodeAddress(placeAddress, true, getBounds());
      if (results.length === 0) {
        onShowToast('No locations found for this address', 'error');
      } else {
        setSearchSuggestions(results);
      }
    } catch {
      onShowToast('Error searching address. Try again.', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

  // Select a suggestion
  const handleSelectSuggestion = (suggestion) => {
    setPlaceAddress(suggestion.address);
    setSelectedCoords({ lat: suggestion.lat, lng: suggestion.lng });
    setSearchSuggestions([]);

    if (!placeName.trim()) {
      let suggestedName = suggestion.name;

      if (!suggestedName) {
        const parts = suggestion.address.split(',');
        const firstPart = parts[0]?.trim();
        const secondPart = parts[1]?.trim();

        const isHouseNumber = /^\d+[a-zA-Z]?$/.test(firstPart);

        if (isHouseNumber && secondPart) {
          suggestedName = `${firstPart} ${secondPart}`;
        } else {
          suggestedName = firstPart || 'Custom Place';
        }
      }

      setPlaceName(suggestedName);
    }
  };

  // Populate form for editing a place
  const handleStartEdit = (place) => {
    setEditingPlaceId(place.id);
    setPlaceName(place.name);
    setPlaceAddress(place.address);
    setPlaceType(place.type);
    setSelectedCoords({ lat: place.lat, lng: place.lng });
    setSearchSuggestions([]);
    
    // Smooth scroll to top of sidebar where the edit card resides
    const scrollable = document.querySelector('.sidebar-scrollable');
    if (scrollable) {
      scrollable.scrollTo({ top: 0, behavior: 'smooth' });
    }
    onShowToast(`Editing "${place.name}"`, 'info');
  };

  // Reset form states
  const handleCancelEdit = () => {
    setEditingPlaceId(null);
    setPlaceName('');
    setPlaceAddress('');
    setPlaceType('other');
    setSelectedCoords(null);
    setSearchSuggestions([]);
  };

  // Add or Edit Place Submit
  const handleAddPlaceSubmit = async (e) => {
    e.preventDefault();
    if (!placeName.trim() || !placeAddress.trim()) {
      onShowToast('Please enter both name and address', 'error');
      return;
    }

    let lat, lng;

    if (selectedCoords) {
      lat = selectedCoords.lat;
      lng = selectedCoords.lng;
    } else {
      setSearchLoading(true);
      try {
        const results = await geocodeAddress(placeAddress, true, getBounds());
        if (results.length === 0) {
          onShowToast('Address not found. Please select from autocomplete or verify address.', 'error');
          setSearchLoading(false);
          return;
        }
        lat = results[0].lat;
        lng = results[0].lng;
        setPlaceAddress(results[0].address);
      } catch {
        onShowToast('Failed to geocode address.', 'error');
        setSearchLoading(false);
        return;
      } finally {
        setSearchLoading(false);
      }
    }

    if (editingPlaceId) {
      onUpdatePlace(editingPlaceId, {
        name: placeName,
        type: placeType,
        address: placeAddress,
        lat,
        lng,
      });
      handleCancelEdit();
    } else {
      if (placeType === 'home' && places.some((p) => p.type === 'home')) {
        onShowToast('Note: You already have a Home location saved.', 'info');
      }
      if (placeType === 'office' && places.some((p) => p.type === 'office')) {
        onShowToast('Note: You already have an Office location saved.', 'info');
      }

      onAddPlace({
        name: placeName,
        type: placeType,
        address: placeAddress,
        lat,
        lng,
      });

      setPlaceName('');
      setPlaceAddress('');
      setPlaceType('other');
      setSelectedCoords(null);
      setSearchSuggestions([]);
      onShowToast('Location saved successfully!', 'success');
    }
  };

  // Quick Add dropdown
  const handleQuickAddStop = (e) => {
    const placeId = e.target.value;
    if (!placeId) return;

    const place = places.find((p) => p.id === placeId);
    if (place) {
      onAddStopToActiveDay(place);
    }
    e.target.value = '';
  };

  const daysOfWeek = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
  ];

  return (
    <div className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div className="sidebar-logo">
            <Compass size={22} />
            <h1>CommuteWise</h1>
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
            Daily Commute Planner
          </p>
        </div>
        
        <button
          onClick={onToggleTheme}
          className="theme-toggle-btn"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      <div className="sidebar-scrollable">
        {/* MODE TABS */}
        <div className="mode-switch">
          <button
            className={`mode-tab ${activeMode === 'schedule' ? 'active' : ''}`}
            onClick={() => {
              setActiveMode('schedule');
              setShowDirections(false);
            }}
          >
            <Calendar size={15} />
            Weekly Planner
          </button>
          <button
            className={`mode-tab ${activeMode === 'sandbox' ? 'active' : ''}`}
            onClick={() => {
              setActiveMode('sandbox');
              setShowDirections(false);
            }}
          >
            <Route size={15} />
            Route Sandbox
          </button>
        </div>

        {/* ADD / EDIT PLACE CARD */}
        <div className="section-card" style={{ borderColor: editingPlaceId ? 'var(--primary)' : '' }}>
          <div className="section-title">
            <h2 style={{ color: editingPlaceId ? 'var(--primary)' : '' }}>
              <MapPin size={16} style={{ color: editingPlaceId ? 'var(--primary)' : 'var(--text-secondary)' }} />
              {editingPlaceId ? 'Edit Saved Place' : 'Add Frequent Place'}
            </h2>
            {editingPlaceId && (
              <button
                type="button"
                className="button-secondary"
                onClick={handleCancelEdit}
                style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
            )}
          </div>

          <form onSubmit={handleAddPlaceSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div className="form-group">
              <label className="form-label">Location Name</label>
              <div className="input-wrapper">
                <Compass className="input-icon" />
                <input
                  type="text"
                  className="text-input"
                  placeholder="E.g., Home, Office, Gym, Cafe"
                  value={placeName}
                  onChange={(e) => setPlaceName(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group" style={{ position: 'relative' }}>
              <label className="form-label">Address or Name</label>
              <div className="input-wrapper" style={{ display: 'flex', gap: '6px' }}>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                  <MapPin className="input-icon" />
                  <input
                    type="text"
                    className="text-input"
                    placeholder="Enter address or business name"
                    value={placeAddress}
                    onChange={(e) => {
                      setPlaceAddress(e.target.value);
                      setSelectedCoords(null);
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleAddressSearch}
                  disabled={searchLoading}
                  style={{ flexShrink: 0, padding: '10px' }}
                  title="Search & verify address"
                >
                  <Search size={16} />
                </button>
              </div>

              {/* Suggestions Dropdown */}
              {searchSuggestions.length > 0 && (
                <div className="search-results-dropdown">
                  {searchSuggestions.map((item, idx) => (
                    <div
                      key={idx}
                      className="search-result-item"
                      onClick={() => handleSelectSuggestion(item)}
                      title={item.address}
                    >
                      {item.address}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkbox to limit radius within 50 miles of Home */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <input
                type="checkbox"
                id="limit-to-local-checkbox"
                checked={limitToLocal}
                disabled={!homePlace}
                onChange={(e) => setLimitToLocal(e.target.checked)}
                style={{
                  width: '14px',
                  height: '14px',
                  cursor: homePlace ? 'pointer' : 'not-allowed',
                  accentColor: 'var(--primary)',
                }}
              />
              <label
                htmlFor="limit-to-local-checkbox"
                style={{
                  fontSize: '12px',
                  color: homePlace ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: homePlace ? 'pointer' : 'not-allowed',
                  fontWeight: 500,
                }}
                title={!homePlace ? 'Save a Home location first to enable this limit' : 'Limit to 50 miles of Home'}
              >
                Limit to 50 miles of Home {!homePlace && <span style={{ fontSize: '10px', color: 'var(--danger)' }}>(Requires Home)</span>}
              </label>
            </div>

            <div className="form-group">
              <label className="form-label">Location Type</label>
              <select
                className="select-input"
                value={placeType}
                onChange={(e) => setPlaceType(e.target.value)}
              >
                <option value="other">Other / Stop</option>
                <option value="home">🏠 Home (Special Location)</option>
                <option value="office">🏢 Office (Special Location)</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button
                type="submit"
                className="button-primary"
                disabled={searchLoading || !placeName.trim() || !placeAddress.trim()}
                style={{ flex: 1 }}
              >
                {editingPlaceId ? <Sparkles size={16} /> : <Plus size={16} />}
                {editingPlaceId ? 'Update Location' : 'Save Location'}
              </button>
              {editingPlaceId && (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleCancelEdit}
                  style={{ padding: '10px' }}
                  title="Cancel edit"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </form>
        </div>

        {/* SAVED PLACES LIST */}
        <div className="section-card">
          <div className="section-title">
            <h2>Saved Places ({places.length})</h2>
          </div>

          {places.length === 0 ? (
            <div className="empty-state">
              <MapPin size={24} />
              <p>No places saved yet.</p>
              <p style={{ fontSize: '11px' }}>Search above or click on the map to add places.</p>
            </div>
          ) : (
            <div className="places-list">
              {places.map((place) => {
                const isHome = place.type === 'home';
                const isOffice = place.type === 'office';
                const isSelectedInSandbox =
                  activeMode === 'sandbox' && sandboxPoints.includes(place.id);
                const isCurrentlyEditing = editingPlaceId === place.id;

                return (
                  <div key={place.id} className="place-card" style={{ borderColor: isCurrentlyEditing ? 'var(--primary)' : '' }}>
                    <div className="place-card-left">
                      <div
                        className={`place-icon-badge ${
                          isHome ? 'home' : isOffice ? 'office' : 'other'
                        }`}
                      >
                        {isHome ? (
                          <HomeIcon size={16} />
                        ) : isOffice ? (
                          <Building2 size={16} />
                        ) : (
                          <MapPin size={16} />
                        )}
                      </div>
                      <div className="place-info">
                        <div className="place-name">
                          {place.name}
                          {isHome && <span className="place-special-tag home">Home</span>}
                          {isOffice && <span className="place-special-tag office">Office</span>}
                        </div>
                        <div className="place-address" title={place.address}>
                          {place.address}
                        </div>
                      </div>
                    </div>

                    <div className="place-actions">
                      {activeMode === 'schedule' ? (
                        <button
                          className="button-secondary"
                          onClick={() => onAddStopToActiveDay(place)}
                          style={{ padding: '6px 8px', fontSize: '11px' }}
                          title="Add to today's schedule"
                        >
                          <Plus size={12} />
                          Add
                        </button>
                      ) : (
                        <button
                          className={`button-secondary ${
                            isSelectedInSandbox ? 'active' : ''
                          }`}
                          onClick={() => onToggleSandboxPoint(place.id)}
                          style={{
                            padding: '6px 8px',
                            fontSize: '11px',
                            borderColor: isSelectedInSandbox ? 'var(--info)' : '',
                            color: isSelectedInSandbox ? 'var(--info)' : '',
                            background: isSelectedInSandbox ? 'var(--info-glow)' : '',
                          }}
                          title="Toggle sandbox routing selection"
                        >
                          {isSelectedInSandbox ? 'Selected' : 'Select'}
                        </button>
                      )}
                      
                      {/* Edit Button */}
                      <button
                        className="button-secondary"
                        onClick={() => handleStartEdit(place)}
                        disabled={isCurrentlyEditing}
                        style={{ padding: '6px', borderColor: isCurrentlyEditing ? 'var(--primary)' : '' }}
                        title="Edit saved place"
                      >
                        <Edit size={12} />
                      </button>

                      {/* Delete Button */}
                      <button
                        className="button-danger"
                        onClick={() => {
                          if (
                            confirm(
                              `Are you sure you want to delete "${place.name}"? This will also remove it from all daily schedules.`
                            )
                          ) {
                            if (isCurrentlyEditing) handleCancelEdit();
                            onDeletePlace(place.id);
                            onShowToast(`Deleted "${place.name}"`, 'info');
                          }
                        }}
                        style={{ padding: '6px' }}
                        title="Delete saved place"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* WEEKLY PLANNER PANEL */}
        {activeMode === 'schedule' && (
          <div className="section-card">
            <div className="section-title">
              <h2>
                <Calendar size={16} style={{ color: 'var(--primary)' }} />
                Daily Road Maps
              </h2>
            </div>

            {/* Days Tabs */}
            <div className="days-tabs">
              {daysOfWeek.map((day) => (
                <button
                  key={day.key}
                  className={`day-tab ${activeDay === day.key ? 'active' : ''}`}
                  onClick={() => {
                    setActiveDay(day.key);
                    setShowDirections(false);
                  }}
                >
                  {day.label}
                </button>
              ))}
            </div>

            {/* Departure Start Time & Copy Schedule HUD */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>Leave:</span>
                <input
                  type="time"
                  className="text-input"
                  style={{ width: '85px', padding: '4px 6px', fontSize: '12px', height: '28px' }}
                  value={startTime || '08:00'}
                  onChange={(e) => onUpdateStartTime(e.target.value)}
                />
              </div>

              {/* Copy Schedule Dropdown */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Copy size={13} style={{ color: 'var(--text-muted)' }} />
                <select
                  className="select-input"
                  onChange={(e) => {
                    if (e.target.value) {
                      if (activeDaySchedule.length > 0) {
                        if (confirm(`Overwrite active schedule for ${activeDay.charAt(0).toUpperCase() + activeDay.slice(1)} with the schedule from ${e.target.value.charAt(0).toUpperCase() + e.target.value.slice(1)}?`)) {
                          onCopySchedule(e.target.value, activeDay);
                        }
                      } else {
                        onCopySchedule(e.target.value, activeDay);
                      }
                      e.target.value = '';
                    }
                  }}
                  defaultValue=""
                  style={{
                    width: '130px',
                    fontSize: '11.5px',
                    padding: '4px 24px 4px 8px',
                    height: '28px',
                    backgroundPosition: 'right 6px center',
                    backgroundSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  <option value="" disabled>Copy from...</option>
                  {daysOfWeek
                    .filter((day) => day.key !== activeDay)
                    .map((day) => {
                      const count = schedules?.[day.key]?.length || 0;
                      return (
                        <option key={day.key} value={day.key} disabled={count === 0}>
                          {day.label} {count > 0 ? `(${count} stop${count === 1 ? '' : 's'})` : '(empty)'}
                        </option>
                      );
                    })}
                </select>
              </div>
            </div>

            {/* Optimize Stop Sequence Button */}
            {activeDaySchedule.length >= 4 && (
              <button
                type="button"
                className="button-secondary"
                onClick={onOptimizeRoute}
                style={{
                  width: '100%',
                  padding: '6px 12px',
                  fontSize: '12px',
                  color: 'var(--success)',
                  borderColor: 'var(--success)',
                  background: 'var(--success-glow)',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
                title="Optimize stop order to minimize distance"
              >
                <Sparkles size={12} />
                Optimize Stop Sequence Order
              </button>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Quick Add Stop Selector */}
              {places.length > 0 && (
                <div className="form-group" style={{ margin: 0 }}>
                  <select
                    className="select-input"
                    onChange={handleQuickAddStop}
                    defaultValue=""
                    style={{ fontSize: '13px', padding: '8px 12px' }}
                  >
                    <option value="" disabled>
                      ➕ Add stop to schedule...
                    </option>
                    {places.map((place) => (
                      <option key={place.id} value={place.id}>
                        {place.name} ({place.type === 'home' ? 'Home' : place.type === 'office' ? 'Office' : place.address.split(',')[0]})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Stop Sequence Itinerary */}
              <div className="schedule-stops-container">
                {activeDaySchedule.length === 0 && !hasHome ? (
                  <div className="empty-state">
                    <Route size={24} />
                    <p>No stops added for {activeDay.charAt(0).toUpperCase() + activeDay.slice(1)}.</p>
                    <p style={{ fontSize: '11px' }}>
                      Click "Add" on saved places or use the dropdown above.
                    </p>
                  </div>
                ) : (
                  timeline.map((stop, index) => {
                    const isFixed = stop.isHomeStart || stop.isHomeEnd;
                    const scheduleIndex = isFixed ? -1 : activeDaySchedule.findIndex((s) => s.id === stop.stopId);

                    return (
                      <TimelineStopCard
                        key={stop.stopId || `fixed-${index}`}
                        stop={stop}
                        index={index}
                        isFixed={isFixed}
                        scheduleIndex={scheduleIndex}
                        activeDaySchedule={activeDaySchedule}
                        timeline={timeline}
                        onReorderStop={onReorderStop}
                        onRemoveStopFromActiveDay={onRemoveStopFromActiveDay}
                        onUpdateStayDuration={onUpdateStayDuration}
                        draggedIndex={draggedIndex}
                        dragOverIndex={dragOverIndex}
                        handleDragStart={handleDragStart}
                        handleDragOver={handleDragOver}
                        handleDragEnd={handleDragEnd}
                        handleDrop={handleDrop}
                      />
                    );
                  })
                )}
              </div>

              {/* Route Statistics */}
              {timeline.length >= 2 && activeRouteDetails && (
                <>
                  <div className="stats-summary">
                    <div className="stat-item">
                      <div className="stat-icon-wrapper">
                        <Route size={16} />
                      </div>
                      <div>
                        <div className="stat-label">Distance</div>
                        <div className="stat-value">
                          {activeRouteDetails.distance.toFixed(1)} mi
                        </div>
                      </div>
                    </div>

                    <div className="stat-item">
                      <div className="stat-icon-wrapper">
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="stat-label">Driving Time</div>
                        <div className="stat-value">
                          {activeRouteDetails.duration < 60
                            ? `${Math.round(activeRouteDetails.duration)} mins`
                            : `${Math.floor(activeRouteDetails.duration / 60)}h ${Math.round(
                                activeRouteDetails.duration % 60
                              )}m`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* External Actions */}
                  <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                    <button
                      type="button"
                      className="button-primary"
                      onClick={handleSendToGoogleMaps}
                      style={{ flex: 1, padding: '8px 12px', fontSize: '12px' }}
                    >
                      <Navigation size={13} />
                      Open Google Maps
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={handleCopySummary}
                      style={{ padding: '8px 12px', fontSize: '12px' }}
                      title="Copy itinerary details to clipboard"
                    >
                      <Copy size={13} />
                    </button>
                  </div>

                  {/* Directions Toggle */}
                  <div>
                    <button
                      className="directions-toggle"
                      onClick={() => setShowDirections(!showDirections)}
                    >
                      <span>
                        {showDirections ? 'Hide Step-by-Step Directions' : 'Show Step-by-Step Directions'}
                      </span>
                      {showDirections ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showDirections && activeRouteDetails.steps && (
                      <div className="directions-list">
                        {activeRouteDetails.steps.map((step, idx) => (
                          <div key={idx} className="direction-step">
                            <span className="direction-text">{step.instruction}</span>
                            <span className="direction-meta">
                              {step.distance.toFixed(2)} mi ({Math.round(step.duration * 2) / 2}m)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* WORKDAY COMMUTE PROJECTIONS */}
        {activeMode === 'schedule' && (
          <div className="section-card" style={{ marginTop: '4px' }}>
            <div className="section-title">
              <h2>
                <Route size={16} style={{ color: 'var(--primary)' }} />
                Workday Projections
              </h2>
            </div>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', marginBottom: '12px', lineHeight: '1.4' }}>
              Driving mileage and time spent on workday commutes (Monday–Friday) only, accounting for the 260 workdays per year.
            </p>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
              {/* Weekly Card */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 6px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Weekly
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  5 workdays
                </div>
                <div style={{ fontSize: '13px', fontWeight: '750', color: 'var(--primary)', marginTop: '4px' }}>
                  {(() => {
                    const total = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                      .reduce((sum, d) => sum + (weeklyStats?.[d]?.distance || 0), 0);
                    return total.toFixed(1);
                  })()} mi
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {(() => {
                    const total = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                      .reduce((sum, d) => sum + (weeklyStats?.[d]?.duration || 0), 0);
                    
                    const hours = total / 60;
                    if (hours === 0) return '0 mins';
                    if (hours < 1) return `${Math.round(total)}m`;
                    const displayH = Math.floor(hours);
                    const displayM = Math.round((hours - displayH) * 60);
                    return displayM > 0 ? `${displayH}h ${displayM}m` : `${displayH}h`;
                  })()}
                </div>
              </div>

              {/* Monthly Card */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 6px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Monthly
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  Avg. 21.7 days
                </div>
                <div style={{ fontSize: '13px', fontWeight: '750', color: 'var(--primary)', marginTop: '4px' }}>
                  {(() => {
                    const total = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                      .reduce((sum, d) => sum + (weeklyStats?.[d]?.distance || 0), 0) * (52 / 12);
                    return total.toFixed(1);
                  })()} mi
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {(() => {
                    const total = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                      .reduce((sum, d) => sum + (weeklyStats?.[d]?.duration || 0), 0) * (52 / 12);
                    
                    const hours = total / 60;
                    if (hours === 0) return '0 mins';
                    if (hours < 1) return `${Math.round(total)}m`;
                    const displayH = Math.floor(hours);
                    const displayM = Math.round((hours - displayH) * 60);
                    return displayM > 0 ? `${displayH}h ${displayM}m` : `${displayH}h`;
                  })()}
                </div>
              </div>

              {/* Yearly Card */}
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 6px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '2px'
              }}>
                <div style={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Yearly
                </div>
                <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                  260 workdays
                </div>
                <div style={{ fontSize: '13px', fontWeight: '750', color: 'var(--primary)', marginTop: '4px' }}>
                  {(() => {
                    const total = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                      .reduce((sum, d) => sum + (weeklyStats?.[d]?.distance || 0), 0) * 52;
                    return total.toLocaleString(undefined, { maximumFractionDigits: 1 });
                  })()} mi
                </div>
                <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-primary)' }}>
                  {(() => {
                    const total = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                      .reduce((sum, d) => sum + (weeklyStats?.[d]?.duration || 0), 0) * 52;
                    
                    const hours = total / 60;
                    if (hours === 0) return '0 mins';
                    if (hours < 1) return `${Math.round(total)}m`;
                    const displayH = Math.floor(hours);
                    const displayM = Math.round((hours - displayH) * 60);
                    return displayM > 0 ? `${displayH}h ${displayM}m` : `${displayH}h`;
                  })()}
                </div>
              </div>
            </div>

            {/* Fun Projection Stats */}
            <div style={{
              borderTop: '1.5px dashed var(--border-color)',
              marginTop: '12px',
              paddingTop: '12px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ fontSize: '11.5px', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                🎧 Commute Entertainment (Yearly)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginTop: '2px' }}>
                {/* Audiobooks */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px'
                }}>
                  <span style={{ fontSize: '15px' }} title="Based on average audiobook length of 10 hours">📚</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--primary)' }}>
                    {(() => {
                      const totalMin = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                        .reduce((sum, d) => sum + (weeklyStats?.[d]?.duration || 0), 0) * 52;
                      return Math.floor(totalMin / 600).toLocaleString(); // 10h = 600m
                    })()}
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: '500' }}>Audiobooks</span>
                </div>

                {/* Songs */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px'
                }}>
                  <span style={{ fontSize: '15px' }} title="Based on average song length of 3.5 minutes">🎵</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--primary)' }}>
                    {(() => {
                      const totalMin = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                        .reduce((sum, d) => sum + (weeklyStats?.[d]?.duration || 0), 0) * 52;
                      return Math.floor(totalMin / 3.5);
                    })().toLocaleString()}
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: '500' }}>Songs</span>
                </div>

                {/* Podcasts */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '8px 4px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '2px'
                }}>
                  <span style={{ fontSize: '15px' }} title="Based on average podcast episode of 45 minutes">🎙️</span>
                  <span style={{ fontSize: '12.5px', fontWeight: '750', color: 'var(--primary)' }}>
                    {(() => {
                      const totalMin = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
                        .reduce((sum, d) => sum + (weeklyStats?.[d]?.duration || 0), 0) * 52;
                      return Math.floor(totalMin / 45).toLocaleString(); // 45m per episode
                    })()}
                  </span>
                  <span style={{ fontSize: '9.5px', color: 'var(--text-muted)', fontWeight: '500' }}>Podcast Eps</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ROUTE SANDBOX PANEL */}
        {activeMode === 'sandbox' && (
          <div className="section-card">
            <div className="section-title">
              <h2>
                <Route size={16} style={{ color: 'var(--info)' }} />
                Ad-hoc Route Sandbox
              </h2>
              {sandboxPoints.length > 0 && (
                <button
                  className="button-secondary"
                  onClick={onClearSandbox}
                  style={{ padding: '4px 8px', fontSize: '11px', color: 'var(--danger)' }}
                >
                  Clear Selection
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                Select multiple saved places (by clicking "Select" next to them or clicking their markers on the map) to instantly calculate route distances.
              </p>

              {/* Selection point list order */}
              <div className="sandbox-points-list">
                {sandboxPoints.length === 0 ? (
                  <div className="empty-state">
                    <Route size={24} style={{ color: 'var(--info)' }} />
                    <p>No places selected for sandbox routing.</p>
                    <p style={{ fontSize: '11px' }}>
                      Click markers on the map or select them from the list above.
                    </p>
                  </div>
                ) : (
                  sandboxPoints.map((placeId, index) => {
                    const place = places.find((p) => p.id === placeId);
                    if (!place) return null;

                    return (
                      <div key={placeId} className="sandbox-point-item">
                        <div className="sandbox-point-info">
                          <div
                            className="stop-number"
                            style={{ background: 'var(--info-glow)', color: 'var(--info)' }}
                          >
                            {index + 1}
                          </div>
                          <span>{place.name}</span>
                        </div>
                        <button
                          className="stop-btn-arrow"
                          onClick={() => onToggleSandboxPoint(placeId)}
                          style={{ color: 'var(--danger)' }}
                          title="Deselect"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Route Statistics */}
              {sandboxPoints.length >= 2 && activeRouteDetails && (
                <>
                  <div className="stats-summary" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="stat-item">
                      <div className="stat-icon-wrapper" style={{ color: 'var(--info)', background: 'var(--info-glow)' }}>
                        <Route size={16} />
                      </div>
                      <div>
                        <div className="stat-label">Sandbox Dist</div>
                        <div className="stat-value" style={{ color: 'var(--info)' }}>
                          {activeRouteDetails.distance.toFixed(1)} mi
                        </div>
                      </div>
                    </div>

                    <div className="stat-item">
                      <div className="stat-icon-wrapper" style={{ color: 'var(--info)', background: 'var(--info-glow)' }}>
                        <Clock size={16} />
                      </div>
                      <div>
                        <div className="stat-label">Est. Driving</div>
                        <div className="stat-value">
                          {activeRouteDetails.duration < 60
                            ? `${Math.round(activeRouteDetails.duration)} mins`
                            : `${Math.floor(activeRouteDetails.duration / 60)}h ${Math.round(
                                activeRouteDetails.duration % 60
                              )}m`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Directions toggle */}
                  <div>
                    <button
                      className="directions-toggle"
                      onClick={() => setShowDirections(!showDirections)}
                    >
                      <span>
                        {showDirections ? 'Hide Step-by-Step Directions' : 'Show Step-by-Step Directions'}
                      </span>
                      {showDirections ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>

                    {showDirections && activeRouteDetails.steps && (
                      <div className="directions-list">
                        {activeRouteDetails.steps.map((step, idx) => (
                          <div key={idx} className="direction-step">
                            <span className="direction-text">{step.instruction}</span>
                            <span className="direction-meta">
                              {step.distance.toFixed(2)} mi ({Math.round(step.duration * 2) / 2}m)
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* BACKUP & SETTINGS CARD */}
        <div className="section-card" style={{ marginTop: '4px' }}>
          <div className="section-title">
            <h2>
              <Settings size={16} style={{ color: 'var(--text-secondary)' }} />
              Backup & Settings
            </h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <p style={{ fontSize: '11.5px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
              Save your frequent places and daily commute schedules, or restore them from a backup.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                className="button-secondary"
                onClick={onExportConfig}
                title="Export configuration as JSON file"
                style={{ fontSize: '12px', padding: '8px 10px' }}
              >
                <Download size={14} />
                Export
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={handleImportClick}
                title="Import configuration JSON file"
                style={{ fontSize: '12px', padding: '8px 10px' }}
              >
                <Upload size={14} />
                Import
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              style={{ display: 'none' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
