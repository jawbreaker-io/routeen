import { useState, useEffect, useMemo, useRef } from 'react';
import {
  CalendarDots,
  Flask,
  MapPin,
  PlusCircle,
  ChartLineUp,
  FloppyDisk,
  Clock,
  Copy,
  Sparkle,
  CaretUp,
  CaretDown,
  X,
  Path,
  NavigationArrow,
  MapTrifold,
  MagnifyingGlass,
  Plus,
  HandTap,
  Trash,
  DownloadSimple,
  UploadSimple,
  CarProfile,
  DotsSixVertical,
  Check,
  Sun,
  Moon,
  ChartBar,
  PencilSimple,
  BookOpenText,
  MusicNotes,
  MicrophoneStage,
} from '@phosphor-icons/react';
import { DAYS_OF_WEEK, WORKDAY_DAYS, getDayLabel } from '../constants/days';
import {
  PLACE_TYPE_OPTIONS,
  getPlaceTypeLabel,
  getPlaceTypeColor,
} from '../constants/placeTypes';
import { geocodeAddress } from '../services/mapService';
import { sparkFromEvent } from '../utils/sparkles';
import TypeDisc from './TypeDisc';

const cx = (...classes) => classes.filter(Boolean).join(' ');

// Format minutes-since-midnight to AM/PM
const formatTime = (minutes) => {
  if (isNaN(minutes)) return '--:--';
  const h = Math.floor(minutes / 60) % 24;
  const m = Math.floor(minutes % 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m < 10 ? `0${m}` : m;
  return `${displayH}:${displayM} ${ampm}`;
};

const formatDuration = (mins) => {
  if (!mins || mins < 1) return '0m';
  const hrs = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (hrs === 0) return `${m}m`;
  return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
};

const sumWeeklyStats = (weeklyStats, days, field) =>
  days.reduce((sum, day) => sum + (weeklyStats?.[day.key]?.[field] || 0), 0);

function PlaceTypeTag({ type }) {
  const color = getPlaceTypeColor(type);
  return (
    <span
      className="place-type-tag"
      style={{ color, background: `${color}1a` }}
    >
      {getPlaceTypeLabel(type)}
    </span>
  );
}

// ---------- Timeline stop card ----------
function TimelineStopCard({
  stop,
  isFixed,
  scheduleIndex,
  activeDaySchedule,
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

  // Sync local input when duration changes externally (e.g. config import).
  const [prevStayDuration, setPrevStayDuration] = useState(stop.stayDuration);
  if (stop.stayDuration !== prevStayDuration) {
    setPrevStayDuration(stop.stayDuration);
    setLocalHours((stop.stayDuration / 60).toString());
  }

  const handleChange = (e) => {
    const val = e.target.value;
    setLocalHours(val);
    const hours = parseFloat(val);
    onUpdateStayDuration(stop.stopId, isNaN(hours) ? 0 : Math.round(hours * 60));
  };
  const handleBlur = () => setLocalHours((parseFloat(localHours) || 0).toString());

  const showDrive = !stop.isLast && stop.driveToNextMinutes > 0.5;
  const timeText = stop.isFirst
    ? `leave ${formatTime(stop.departureMinutes)}`
    : stop.isLast
      ? `arrive ${formatTime(stop.arrivalMinutes)}`
      : `${formatTime(stop.arrivalMinutes)} → ${formatTime(stop.departureMinutes)}`;
  const homeTag = stop.isHomeStart ? ' · start' : stop.isHomeEnd ? ' · end' : '';

  return (
    <>
      <div
        className={cx(
          'stop-card',
          isFixed && 'is-home',
          showDrive && 'has-drive',
          !isFixed && 'draggable',
          !isFixed && draggedIndex === scheduleIndex && 'is-dragging',
          !isFixed && dragOverIndex === scheduleIndex && 'drag-over'
        )}
        draggable={!isFixed}
        onDragStart={!isFixed ? (e) => handleDragStart(e, scheduleIndex) : undefined}
        onDragOver={!isFixed ? (e) => handleDragOver(e, scheduleIndex) : undefined}
        onDragEnd={!isFixed ? handleDragEnd : undefined}
        onDrop={!isFixed ? (e) => handleDrop(e, scheduleIndex) : undefined}
      >
        <div className="stop-card-top">
          {!isFixed && (
            <span className="grip-handle" title="Drag to reorder">
              <DotsSixVertical size={14} weight="bold" />
            </span>
          )}
          {isFixed ? (
            <TypeDisc type="home" size={34} iconSize={15} shadow="ring" />
          ) : (
            <TypeDisc type={stop.placeType} size={34} shadow="ring">
              <span className="stop-num">{scheduleIndex + 1}</span>
            </TypeDisc>
          )}
          <div className="stop-main">
            <div className="stop-name" title={stop.placeName}>
              {stop.placeName}
              {homeTag && (
                <span style={{ color: 'var(--fg-3)', fontWeight: 500 }}>{homeTag}</span>
              )}
            </div>
            <div className="stop-time">{timeText}</div>
          </div>
          {!isFixed && (
            <div className="stop-actions">
              <button
                type="button"
                className="icon-btn-sm"
                onClick={() => onReorderStop(scheduleIndex, scheduleIndex - 1)}
                disabled={scheduleIndex === 0}
                title="Move up"
              >
                <CaretUp size={12} weight="bold" />
              </button>
              <button
                type="button"
                className="icon-btn-sm"
                onClick={() => onReorderStop(scheduleIndex, scheduleIndex + 1)}
                disabled={scheduleIndex === activeDaySchedule.length - 1}
                title="Move down"
              >
                <CaretDown size={12} weight="bold" />
              </button>
              <button
                type="button"
                className="icon-btn-sm danger"
                onClick={() => onRemoveStopFromActiveDay(stop.stopId)}
                title="Remove"
              >
                <X size={12} weight="bold" />
              </button>
            </div>
          )}
        </div>

        {!isFixed && (
          <div className="stop-stay-row">
            <span className="stay-label">stay</span>
            <div className="stay-input-pill">
              <input
                type="number"
                step="0.5"
                min="0"
                value={localHours}
                onChange={handleChange}
                onBlur={handleBlur}
                title="Stay duration in hours"
              />
              <span className="stay-unit">h</span>
            </div>
          </div>
        )}
      </div>

      {showDrive && (
        <div className="drive-connector">
          <CarProfile size={14} weight="fill" style={{ color: 'var(--candy-blue)' }} />
          <span className="drive-text">
            drive {Math.round(stop.driveToNextMinutes)} min · {stop.driveToNextMiles.toFixed(1)} mi
          </span>
        </div>
      )}
    </>
  );
}

// ---------- Header ----------
function SidebarHeader({ theme, onToggleTheme, onOpenDashboard }) {
  return (
    <header className="sidebar-header">
      <div className="sidebar-brand">
        <span className="jb-mark jb-mark--bob" style={{ width: 46, height: 46 }}>
          <span className="jb-mark-gloss" />
          <MapPin className="jb-mark-pin" size={13} weight="fill" />
        </span>
        <div>
          <div className="sidebar-wordmark">routeen</div>
          <div className="sidebar-subtitle">weekly commute planner</div>
        </div>
      </div>
      <div className="sidebar-header-actions">
        <button
          type="button"
          className="header-round-btn"
          onClick={onToggleTheme}
          title="Toggle light / dark"
        >
          {theme === 'dark' ? <Sun size={17} weight="fill" /> : <Moon size={17} weight="fill" />}
        </button>
        <button
          type="button"
          className="header-round-btn"
          onClick={onOpenDashboard}
          title="Weekly insights"
        >
          <ChartBar size={18} weight="bold" />
        </button>
      </div>
    </header>
  );
}

function ModeSwitch({ activeMode, onModeChange }) {
  return (
    <div className="mode-switch">
      <button
        type="button"
        className={cx('mode-tab', activeMode === 'schedule' && 'active')}
        onClick={() => onModeChange('schedule')}
      >
        <CalendarDots size={16} weight="bold" /> weekly planner
      </button>
      <button
        type="button"
        className={cx('mode-tab', activeMode === 'sandbox' && 'active')}
        onClick={() => onModeChange('sandbox')}
      >
        <Flask size={16} weight="bold" /> sandbox
      </button>
    </div>
  );
}

function MobileSheetHandle({ state, summary, onCycle }) {
  const label =
    summary.meta ? `${summary.title} · ${summary.meta}` : summary.title;
  return (
    <div className="mobile-sheet-handle-row">
      <button
        type="button"
        className="mobile-sheet-handle"
        onClick={onCycle}
        aria-expanded={state !== 'peek'}
      >
        <span className="mobile-sheet-grip" aria-hidden="true" />
        <span className="mobile-sheet-summary">
          <span className="mobile-sheet-title">{label}</span>
          <span className="mobile-sheet-state-icon" aria-hidden="true">
            {state === 'full' ? (
              <CaretDown size={16} weight="bold" />
            ) : (
              <CaretUp size={16} weight="bold" />
            )}
          </span>
        </span>
      </button>
    </div>
  );
}

// ---------- Saved places ----------
function SavedPlacesTray({
  places,
  activeMode,
  sandboxPoints,
  editingPlaceId,
  onAddStopToActiveDay,
  onToggleSandboxPoint,
  onStartEdit,
  onCancelEdit,
  onDeletePlace,
  onShowToast,
}) {
  const [query, setQuery] = useState('');
  const filteredPlaces = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return places;
    return places.filter((p) =>
      [p.name, p.address, getPlaceTypeLabel(p.type)]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [places, query]);

  const isSchedule = activeMode === 'schedule';

  return (
    <section className="section-card">
      <div className="section-title">
        <MapPin size={19} weight="fill" style={{ color: 'var(--candy-blue)' }} />
        <h2>saved places</h2>
        <span className="section-count-badge">{places.length}</span>
      </div>

      <div className="search-wrap">
        <MagnifyingGlass className="input-icon" size={15} />
        <input
          type="search"
          className="text-input with-icon"
          placeholder="search name, address, or type"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="saved-places-list">
        {filteredPlaces.length === 0 ? (
          <div className="no-results">no places match that search.</div>
        ) : (
          filteredPlaces.map((place) => {
            const inSandbox = !isSchedule && sandboxPoints.includes(place.id);
            const pillColor = isSchedule
              ? 'var(--accent)'
              : inSandbox
                ? 'var(--candy-green)'
                : 'var(--candy-blue)';
            const pillLabel = isSchedule ? 'add' : inSandbox ? 'added' : 'select';
            return (
              <div
                key={place.id}
                className={cx('saved-place-row', editingPlaceId === place.id && 'editing')}
              >
                <TypeDisc type={place.type} size={38} radius={13} iconSize={17} />
                <div className="saved-place-info">
                  <div className="saved-place-nameline">
                    <span className="saved-place-name">{place.name}</span>
                    <PlaceTypeTag type={place.type} />
                  </div>
                  <div className="saved-place-address" title={place.address}>
                    {place.address}
                  </div>
                </div>
                <div className="saved-place-actions">
                  <button
                    type="button"
                    className="pill-action"
                    style={{ background: pillColor }}
                    onClick={(e) => {
                      if (isSchedule) {
                        onAddStopToActiveDay(place);
                        sparkFromEvent(e);
                      } else {
                        onToggleSandboxPoint(place.id);
                        if (!inSandbox) sparkFromEvent(e);
                      }
                    }}
                    title={isSchedule ? 'Add to active day' : 'Toggle sandbox'}
                  >
                    {inSandbox ? <Check size={13} weight="bold" /> : <Plus size={13} weight="bold" />}
                    <span>{pillLabel}</span>
                  </button>
                  <button
                    type="button"
                    className="round-icon-btn"
                    onClick={() => onStartEdit(place)}
                    disabled={editingPlaceId === place.id}
                    title="Edit place"
                  >
                    <PencilSimple size={13} weight="bold" />
                  </button>
                  <button
                    type="button"
                    className="round-icon-btn danger"
                    onClick={() => {
                      if (
                        confirm(
                          `Delete "${place.name}"? This also removes it from all daily schedules.`
                        )
                      ) {
                        if (editingPlaceId === place.id) onCancelEdit();
                        onDeletePlace(place.id);
                        onShowToast(`Deleted "${place.name}"`, 'info');
                      }
                    }}
                    title="Delete place"
                  >
                    <Trash size={13} weight="bold" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

// ---------- Add / edit place ----------
function PlaceFormPanel({
  panelRef,
  isOpen,
  editingPlaceId,
  placeName,
  placeAddress,
  placeType,
  searchLoading,
  searchSuggestions,
  limitToLocal,
  homePlace,
  onToggle,
  onSubmit,
  onCancelEdit,
  onAddressSearch,
  onSelectSuggestion,
  onPlaceNameChange,
  onPlaceAddressChange,
  onPlaceTypeChange,
  onLimitToLocalChange,
}) {
  return (
    <section className="section-card" ref={panelRef}>
      <button type="button" className="collapse-header" onClick={onToggle}>
        <PlusCircle size={19} weight="fill" style={{ color: 'var(--candy-green)' }} />
        <h2>{editingPlaceId ? 'edit place' : 'add a place'}</h2>
        {editingPlaceId && (
          <span
            className="link-btn"
            role="button"
            onClick={(e) => {
              e.stopPropagation();
              onCancelEdit();
            }}
            style={{ color: 'var(--fg-3)' }}
          >
            cancel
          </span>
        )}
        {isOpen ? (
          <CaretUp className="collapse-caret" size={16} weight="bold" />
        ) : (
          <CaretDown className="collapse-caret" size={16} weight="bold" />
        )}
      </button>

      {isOpen && (
        <form className="form-fields" onSubmit={onSubmit}>
          <div className="form-group">
            <label className="form-label">name</label>
            <input
              type="text"
              className="text-input"
              placeholder="e.g. Dentist, Pilates, Mom's"
              value={placeName}
              onChange={(e) => onPlaceNameChange(e.target.value)}
            />
          </div>

          <div className="form-group" style={{ position: 'relative' }}>
            <label className="form-label">address or name</label>
            <div className="field-with-button">
              <div className="input-wrap">
                <MapPin className="input-icon" size={15} />
                <input
                  type="text"
                  className="text-input with-icon"
                  placeholder="enter address or business name"
                  value={placeAddress}
                  onChange={(e) => onPlaceAddressChange(e.target.value)}
                />
              </div>
              <button
                type="button"
                className="icon-square-btn"
                onClick={onAddressSearch}
                disabled={searchLoading}
                title="Search & verify address"
              >
                <MagnifyingGlass size={16} weight="bold" />
              </button>
            </div>
            {searchSuggestions.length > 0 && (
              <div className="search-results-dropdown">
                {searchSuggestions.map((item, idx) => (
                  <div
                    key={`${item.address}-${idx}`}
                    className="search-result-item"
                    onClick={() => onSelectSuggestion(item)}
                    title={item.address}
                  >
                    {item.address}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="limit-checkbox-row">
            <input
              type="checkbox"
              id="limit-to-local-checkbox"
              checked={limitToLocal}
              disabled={!homePlace}
              onChange={(e) => onLimitToLocalChange(e.target.checked)}
            />
            <label htmlFor="limit-to-local-checkbox">
              limit to 50 miles of home
              {!homePlace && (
                <span style={{ color: 'var(--candy-raspberry)' }}> (requires home)</span>
              )}
            </label>
          </div>

          <div className="form-group">
            <label className="form-label">flavor</label>
            <select
              className="select-input"
              value={placeType}
              onChange={(e) => onPlaceTypeChange(e.target.value)}
            >
              {PLACE_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-tip">
            <HandTap className="tip-icon" size={15} weight="fill" />
            <span>tip: tap anywhere on the map to drop a pin exactly where you want</span>
          </div>

          <button
            type="submit"
            className="btn-primary green"
            disabled={searchLoading || !placeName.trim() || !placeAddress.trim()}
          >
            {editingPlaceId ? <Check size={15} weight="bold" /> : <Plus size={15} weight="bold" />}
            {editingPlaceId ? 'update place' : 'save place'}
          </button>
        </form>
      )}
    </section>
  );
}

// ---------- Weekly planner ----------
function WeeklyPlannerSection({
  activeDay,
  setActiveDay,
  activeDaySchedule,
  startTime,
  onUpdateStartTime,
  onCopySchedule,
  schedules,
  onOptimizeRoute,
  timeline,
  activeRouteDetails,
  showDirections,
  setShowDirections,
  onSendToGoogleMaps,
  onCopySummary,
  draggedIndex,
  dragOverIndex,
  handleDragStart,
  handleDragOver,
  handleDragEnd,
  handleDrop,
  onReorderStop,
  onRemoveStopFromActiveDay,
  onUpdateStayDuration,
}) {
  const hasStops = activeDaySchedule.length > 0;
  const hasRoute = timeline.length >= 2 && activeRouteDetails;

  return (
    <section className="section-card">
      <div className="section-title">
        <CalendarDots size={19} weight="fill" style={{ color: 'var(--candy-raspberry)' }} />
        <h2>daily road maps</h2>
      </div>

      <div className="days-tabs">
        {DAYS_OF_WEEK.map((day) => {
          const dayHasStops = (schedules?.[day.key]?.length || 0) > 0;
          return (
            <button
              type="button"
              key={day.key}
              className={cx('day-tab', activeDay === day.key && 'active')}
              title={day.label}
              onClick={() => {
                setActiveDay(day.key);
                setShowDirections(false);
              }}
            >
              <span>{day.short}</span>
              <span className={cx('day-tab-dot', dayHasStops && 'has-stops')} />
            </button>
          );
        })}
      </div>

      <div className="planner-controls">
        <div className="leave-pill">
          <Clock size={15} weight="bold" style={{ color: 'var(--candy-blue)' }} />
          <span className="leave-label">leave</span>
          <input
            type="time"
            value={startTime || '08:00'}
            onChange={(e) => onUpdateStartTime(e.target.value)}
          />
        </div>
        <div className="copy-day-wrap">
          <Copy size={14} weight="bold" style={{ color: 'var(--fg-3)' }} />
          <select
            className="copy-day-select"
            defaultValue=""
            onChange={(e) => {
              const from = e.target.value;
              if (!from) return;
              if (
                activeDaySchedule.length === 0 ||
                confirm(
                  `Overwrite ${getDayLabel(activeDay)} with the schedule from ${getDayLabel(from)}?`
                )
              ) {
                onCopySchedule(from, activeDay);
              }
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              copy a day…
            </option>
            {DAYS_OF_WEEK.filter((d) => d.key !== activeDay).map((d) => {
              const count = schedules?.[d.key]?.length || 0;
              return (
                <option key={d.key} value={d.key} disabled={count === 0}>
                  {d.label} {count > 0 ? `(${count})` : '(empty)'}
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {activeDaySchedule.length >= 2 && (
        <button
          type="button"
          className="optimize-btn"
          onClick={(e) => {
            onOptimizeRoute();
            sparkFromEvent(e);
          }}
          title="Optimize stop order to minimize distance"
        >
          <Sparkle size={15} weight="fill" /> optimize stop order
        </button>
      )}

      <div className="schedule-stops-container">
        {timeline.map((stop, index) => {
          const isFixed = stop.isHomeStart || stop.isHomeEnd;
          const scheduleIndex = isFixed
            ? -1
            : activeDaySchedule.findIndex((s) => s.id === stop.stopId);
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
        })}

        {!hasStops && (
          <div className="empty-state">
            <MapTrifold className="empty-icon" size={26} />
            <p>no stops yet for {getDayLabel(activeDay)}</p>
            <p className="sub">add places from your tray below, or tap a marker on the map</p>
          </div>
        )}
      </div>

      {hasRoute && (
        <>
          <div className="stats-summary">
            <div className="stat-tile">
              <div className="stat-tile-icon distance">
                <Path size={17} weight="bold" />
              </div>
              <div>
                <div className="stat-label">distance</div>
                <div className="stat-value">{activeRouteDetails.distance.toFixed(1)} mi</div>
              </div>
            </div>
            <div className="stat-tile">
              <div className="stat-tile-icon duration">
                <Clock size={17} weight="bold" />
              </div>
              <div>
                <div className="stat-label">drive time</div>
                <div className="stat-value">{formatDuration(activeRouteDetails.duration)}</div>
              </div>
            </div>
          </div>

          <button type="button" className="btn-primary open-maps-btn" onClick={onSendToGoogleMaps}>
            <NavigationArrow size={15} weight="fill" /> open in google maps
          </button>

          <button type="button" className="directions-toggle" onClick={onCopySummary}>
            <Copy size={14} weight="bold" /> copy itinerary
          </button>

          <button
            type="button"
            className="directions-toggle"
            onClick={() => setShowDirections(!showDirections)}
          >
            <span>{showDirections ? 'hide step-by-step directions' : 'show step-by-step directions'}</span>
            {showDirections ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
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
        </>
      )}
    </section>
  );
}

// ---------- Sandbox ----------
function SandboxRouteBuilderSection({
  places,
  sandboxPoints,
  onToggleSandboxPoint,
  onClearSandbox,
  activeRouteDetails,
  showDirections,
  setShowDirections,
}) {
  const hasRoute = sandboxPoints.length >= 2 && activeRouteDetails;
  return (
    <section className="section-card">
      <div className="section-title">
        <Flask size={19} weight="fill" style={{ color: 'var(--candy-blue)' }} />
        <h2 style={{ flex: 1 }}>route sandbox</h2>
        {sandboxPoints.length > 0 && (
          <button type="button" className="link-btn" onClick={onClearSandbox}>
            clear
          </button>
        )}
      </div>
      <p className="sandbox-intro">
        drop any places onto a throwaway route to compare distances — no schedule, no home anchor.
      </p>

      <div className="sandbox-list">
        {sandboxPoints.length === 0 ? (
          <div className="empty-state">
            <Flask className="empty-icon" size={24} />
            <p>no points selected</p>
            <p className="sub">select places below or tap map markers</p>
          </div>
        ) : (
          sandboxPoints.map((placeId, index) => {
            const place = places.find((p) => p.id === placeId);
            if (!place) return null;
            return (
              <div key={placeId} className="sandbox-row">
                <span className="sandbox-num-disc">{index + 1}</span>
                <span className="sandbox-name">{place.name}</span>
                <button
                  type="button"
                  className="icon-btn-sm danger"
                  onClick={() => onToggleSandboxPoint(placeId)}
                  title="Remove"
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            );
          })
        )}
      </div>

      {hasRoute && (
        <>
          <div className="sandbox-stats">
            <div className="sandbox-stat">
              <div className="stat-label">distance</div>
              <div className="stat-value">{activeRouteDetails.distance.toFixed(1)} mi</div>
            </div>
            <div className="sandbox-stat">
              <div className="stat-label">drive time</div>
              <div className="stat-value">{formatDuration(activeRouteDetails.duration)}</div>
            </div>
          </div>

          <button
            type="button"
            className="directions-toggle"
            onClick={() => setShowDirections(!showDirections)}
          >
            <span>{showDirections ? 'hide step-by-step directions' : 'show step-by-step directions'}</span>
            {showDirections ? <CaretUp size={14} weight="bold" /> : <CaretDown size={14} weight="bold" />}
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
        </>
      )}
    </section>
  );
}

// ---------- Commute projections ----------
function CommuteProjectionsSection({ weeklyStats }) {
  const [projectionMode, setProjectionMode] = useState('workdays');
  const isWorkdays = projectionMode === 'workdays';
  const projectionDays = isWorkdays ? WORKDAY_DAYS : DAYS_OF_WEEK;
  const weekDistance = sumWeeklyStats(weeklyStats, projectionDays, 'distance');
  const weekDuration = sumWeeklyStats(weeklyStats, projectionDays, 'duration');
  const count = projectionDays.length;
  const yearDuration = weekDuration * 52;

  const cards = [
    {
      title: 'weekly',
      sub: `${count} ${isWorkdays ? 'workdays' : 'days'}`,
      dist: `${weekDistance.toFixed(1)} mi`,
      dur: formatDuration(weekDuration),
    },
    {
      title: 'monthly',
      sub: `~${Math.round((count * 52) / 12)} days`,
      dist: `${((weekDistance * 52) / 12).toFixed(0)} mi`,
      dur: formatDuration((weekDuration * 52) / 12),
    },
    {
      title: 'yearly',
      sub: `${count * 52} days`,
      dist: `${(weekDistance * 52).toLocaleString(undefined, { maximumFractionDigits: 0 })} mi`,
      dur: formatDuration(yearDuration),
    },
  ];

  const entertainment = [
    {
      Icon: BookOpenText,
      color: 'var(--candy-raspberry)',
      value: Math.floor(yearDuration / 600).toLocaleString(),
      label: 'audiobooks',
    },
    {
      Icon: MusicNotes,
      color: 'var(--candy-green)',
      value: Math.floor(yearDuration / 3.5).toLocaleString(),
      label: 'songs',
    },
    {
      Icon: MicrophoneStage,
      color: 'var(--candy-blue)',
      value: Math.floor(yearDuration / 45).toLocaleString(),
      label: 'podcasts',
    },
  ];

  return (
    <section className="section-card">
      <div className="section-title">
        <ChartLineUp size={19} weight="fill" style={{ color: 'var(--candy-gold)' }} />
        <h2>commute projections</h2>
      </div>
      <div className="projection-toggle">
        <button
          type="button"
          className={cx('projection-toggle-btn', isWorkdays && 'active')}
          onClick={() => setProjectionMode('workdays')}
        >
          workdays
        </button>
        <button
          type="button"
          className={cx('projection-toggle-btn', !isWorkdays && 'active')}
          onClick={() => setProjectionMode('full-week')}
        >
          full week
        </button>
      </div>
      <p className="projection-intro">
        {isWorkdays
          ? 'driving across your mon–fri commutes, over ~260 workdays a year.'
          : 'driving across the full week, weekends included, over 52 weeks.'}
      </p>

      <div className="projection-cards">
        {cards.map((c) => (
          <div className="projection-card" key={c.title}>
            <div className="projection-card-title">{c.title}</div>
            <div className="projection-card-subtitle">{c.sub}</div>
            <div className="projection-card-distance">{c.dist}</div>
            <div className="projection-card-duration">{c.dur}</div>
          </div>
        ))}
      </div>

      <div className="projection-entertainment">
        <div className="projection-entertainment-title">a year of driving =</div>
        <div className="projection-ent-grid">
          {entertainment.map((e) => (
            <div className="projection-mini-card" key={e.label}>
              <e.Icon size={18} weight="fill" style={{ color: e.color }} />
              <div className="projection-mini-value">{e.value}</div>
              <div className="projection-mini-label">{e.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------- Backup ----------
function SettingsSection({ fileInputRef, onExportConfig, onImportClick, onFileChange }) {
  return (
    <section className="section-card">
      <div className="section-title">
        <FloppyDisk size={18} weight="fill" style={{ color: 'var(--fg-2)' }} />
        <h2>backup</h2>
      </div>
      <p className="backup-text">save your places &amp; weekly routes to a file, or restore from one.</p>
      <div className="backup-grid">
        <button type="button" className="btn-secondary" onClick={onExportConfig}>
          <DownloadSimple size={15} weight="bold" /> export
        </button>
        <button type="button" className="btn-secondary" onClick={onImportClick}>
          <UploadSimple size={15} weight="bold" /> import
        </button>
      </div>
      <input type="file" ref={fileInputRef} onChange={onFileChange} accept=".json" style={{ display: 'none' }} />
    </section>
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
  onOpenDashboard,
  mobileSheetState = 'peek',
  onMobileSheetStateChange,
  onCycleMobileSheet = () => {},
  mobileSheetSummary = { title: 'Planner', meta: '' },
}) {
  const [placeName, setPlaceName] = useState('');
  const [placeAddress, setPlaceAddress] = useState('');
  const [placeType, setPlaceType] = useState('other');
  const [editingPlaceId, setEditingPlaceId] = useState(null);
  const [isPlaceFormOpen, setIsPlaceFormOpen] = useState(false);
  const placeFormRef = useRef(null);
  const fileInputRef = useRef(null);

  // Drag and drop
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
    if (dragOverIndex !== index) setDragOverIndex(index);
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

  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const config = JSON.parse(event.target.result);
        if (!config || typeof config !== 'object') throw new Error('Configuration must be a JSON object.');
        if (!config.places || !Array.isArray(config.places)) throw new Error('Configuration missing a valid "places" array.');
        if (!config.schedules || typeof config.schedules !== 'object') throw new Error('Configuration missing a valid "schedules" object.');
        const isValidPlaces = config.places.every(
          (p) => p && typeof p === 'object' && p.id && p.name && p.type && typeof p.lat === 'number' && typeof p.lng === 'number'
        );
        if (!isValidPlaces) throw new Error('Some places have invalid/missing properties.');
        onImportConfig(config);
        onShowToast('Configuration imported successfully!', 'success');
      } catch (err) {
        onShowToast('Import failed: ' + err.message, 'error');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const [limitToLocal, setLimitToLocal] = useState(() => places.some((p) => p.type === 'home'));
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [selectedCoords, setSelectedCoords] = useState(null);
  const [showDirections, setShowDirections] = useState(false);

  const homePlace = places.find((p) => p.type === 'home');
  const hasHome = !!homePlace;
  const prevHasHomeRef = useRef(hasHome);

  useEffect(() => {
    if (hasHome && !prevHasHomeRef.current) setLimitToLocal(true);
    else if (!hasHome && prevHasHomeRef.current) setLimitToLocal(false);
    prevHasHomeRef.current = hasHome;
  }, [hasHome]);

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

  // Debounced typeahead
  useEffect(() => {
    if (placeAddress.trim().length < 4 || selectedCoords) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchSuggestions([]);
      return;
    }
    const delay = setTimeout(async () => {
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
    return () => clearTimeout(delay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeAddress, selectedCoords, limitToLocal, places]);

  const handleSendToGoogleMaps = () => {
    if (activeDaySchedule.length < 2) return;
    const coords = activeDaySchedule.map((stop) => places.find((p) => p.id === stop.placeId)).filter(Boolean);
    if (coords.length < 2) return;
    const origin = `${coords[0].lat},${coords[0].lng}`;
    const destination = `${coords[coords.length - 1].lat},${coords[coords.length - 1].lng}`;
    const waypoints = coords.slice(1, -1).map((c) => `${c.lat},${c.lng}`).join('%7C');
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&waypoints=${waypoints}&travelmode=driving`;
    window.open(url, '_blank');
    onShowToast('Opening route in Google Maps!', 'success');
  };

  const handleCopySummary = () => {
    if (activeDaySchedule.length === 0) return;
    let text = `Routeen Route - ${getDayLabel(activeDay)}\n`;
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
      if (fullPlace) text += `   Address: ${fullPlace.address}\n`;
      if (item.stayDuration > 0 && !item.isLast) {
        const hours = item.stayDuration / 60;
        text += `   Stay duration: ${hours} ${hours === 1 ? 'hour' : 'hours'}\n`;
      }
      if (!item.isLast && item.driveToNextMinutes > 0) {
        text += `   Drive to next: ${Math.round(item.driveToNextMinutes)} mins (${item.driveToNextMiles.toFixed(1)} miles)\n`;
      }
    });
    navigator.clipboard.writeText(text);
    onShowToast('Itinerary copied to clipboard!', 'success');
  };

  const handleAddressSearch = async (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!placeAddress.trim()) {
      onShowToast('Please enter an address to search', 'error');
      return;
    }
    setSearchLoading(true);
    setSearchSuggestions([]);
    setSelectedCoords(null);
    try {
      const results = await geocodeAddress(placeAddress, true, getBounds());
      if (results.length === 0) onShowToast('No locations found for this address', 'error');
      else setSearchSuggestions(results);
    } catch {
      onShowToast('Error searching address. Try again.', 'error');
    } finally {
      setSearchLoading(false);
    }
  };

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
        suggestedName = isHouseNumber && secondPart ? `${firstPart} ${secondPart}` : firstPart || 'Custom Place';
      }
      setPlaceName(suggestedName);
    }
  };

  const handleStartEdit = (place) => {
    setEditingPlaceId(place.id);
    setPlaceName(place.name);
    setPlaceAddress(place.address);
    setPlaceType(place.type);
    setSelectedCoords({ lat: place.lat, lng: place.lng });
    setSearchSuggestions([]);
    setIsPlaceFormOpen(true);
    window.requestAnimationFrame(() => {
      placeFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    onShowToast(`Editing "${place.name}"`, 'info');
  };

  const handleCancelEdit = () => {
    setEditingPlaceId(null);
    setPlaceName('');
    setPlaceAddress('');
    setPlaceType('other');
    setSelectedCoords(null);
    setSearchSuggestions([]);
    setIsPlaceFormOpen(false);
  };

  const handleTogglePlaceForm = () => {
    if (isPlaceFormOpen && editingPlaceId) {
      handleCancelEdit();
      return;
    }
    setIsPlaceFormOpen((prev) => !prev);
  };

  const handleModeChange = (mode) => {
    setActiveMode(mode);
    setShowDirections(false);
    onMobileSheetStateChange?.('half');
  };

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
          onShowToast('Address not found. Select from autocomplete or verify address.', 'error');
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
      onUpdatePlace(editingPlaceId, { name: placeName, type: placeType, address: placeAddress, lat, lng });
      handleCancelEdit();
    } else {
      if (placeType === 'home' && places.some((p) => p.type === 'home')) {
        onShowToast('Note: You already have a Home location saved.', 'info');
      }
      if (placeType === 'office' && places.some((p) => p.type === 'office')) {
        onShowToast('Note: You already have an Office location saved.', 'info');
      }
      onAddPlace({ name: placeName, type: placeType, address: placeAddress, lat, lng });
      if (e?.nativeEvent?.submitter) sparkFromEvent({ currentTarget: e.nativeEvent.submitter });
      setPlaceName('');
      setPlaceAddress('');
      setPlaceType('other');
      setSelectedCoords(null);
      setSearchSuggestions([]);
      onShowToast('Location saved successfully!', 'success');
    }
  };

  return (
    <aside className={cx('sidebar', `mobile-sheet-${mobileSheetState || 'peek'}`)}>
      <MobileSheetHandle
        state={mobileSheetState || 'peek'}
        summary={mobileSheetSummary}
        onCycle={onCycleMobileSheet}
      />

      <SidebarHeader theme={theme} onToggleTheme={onToggleTheme} onOpenDashboard={onOpenDashboard} />

      <div className="sidebar-scrollable rt-scroll">
        <ModeSwitch activeMode={activeMode} onModeChange={handleModeChange} />

        {activeMode === 'schedule' ? (
          <WeeklyPlannerSection
            activeDay={activeDay}
            setActiveDay={setActiveDay}
            activeDaySchedule={activeDaySchedule}
            startTime={startTime}
            onUpdateStartTime={onUpdateStartTime}
            onCopySchedule={onCopySchedule}
            schedules={schedules}
            onOptimizeRoute={onOptimizeRoute}
            timeline={timeline}
            activeRouteDetails={activeRouteDetails}
            showDirections={showDirections}
            setShowDirections={setShowDirections}
            onSendToGoogleMaps={handleSendToGoogleMaps}
            onCopySummary={handleCopySummary}
            draggedIndex={draggedIndex}
            dragOverIndex={dragOverIndex}
            handleDragStart={handleDragStart}
            handleDragOver={handleDragOver}
            handleDragEnd={handleDragEnd}
            handleDrop={handleDrop}
            onReorderStop={onReorderStop}
            onRemoveStopFromActiveDay={onRemoveStopFromActiveDay}
            onUpdateStayDuration={onUpdateStayDuration}
          />
        ) : (
          <SandboxRouteBuilderSection
            places={places}
            sandboxPoints={sandboxPoints}
            onToggleSandboxPoint={onToggleSandboxPoint}
            onClearSandbox={onClearSandbox}
            activeRouteDetails={activeRouteDetails}
            showDirections={showDirections}
            setShowDirections={setShowDirections}
          />
        )}

        <SavedPlacesTray
          places={places}
          activeMode={activeMode}
          sandboxPoints={sandboxPoints}
          editingPlaceId={editingPlaceId}
          onAddStopToActiveDay={onAddStopToActiveDay}
          onToggleSandboxPoint={onToggleSandboxPoint}
          onStartEdit={handleStartEdit}
          onCancelEdit={handleCancelEdit}
          onDeletePlace={onDeletePlace}
          onShowToast={onShowToast}
        />

        <PlaceFormPanel
          panelRef={placeFormRef}
          isOpen={isPlaceFormOpen}
          editingPlaceId={editingPlaceId}
          placeName={placeName}
          placeAddress={placeAddress}
          placeType={placeType}
          searchLoading={searchLoading}
          searchSuggestions={searchSuggestions}
          limitToLocal={limitToLocal}
          homePlace={homePlace}
          onToggle={handleTogglePlaceForm}
          onSubmit={handleAddPlaceSubmit}
          onCancelEdit={handleCancelEdit}
          onAddressSearch={handleAddressSearch}
          onSelectSuggestion={handleSelectSuggestion}
          onPlaceNameChange={setPlaceName}
          onPlaceAddressChange={(value) => {
            setPlaceAddress(value);
            setSelectedCoords(null);
          }}
          onPlaceTypeChange={setPlaceType}
          onLimitToLocalChange={setLimitToLocal}
        />

        {activeMode === 'schedule' && <CommuteProjectionsSection weeklyStats={weeklyStats} />}

        <SettingsSection
          fileInputRef={fileInputRef}
          onExportConfig={onExportConfig}
          onImportClick={handleImportClick}
          onFileChange={handleFileChange}
        />
      </div>
    </aside>
  );
}
