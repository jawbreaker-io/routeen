import { useState } from 'react';
import {
  X,
  Calendar,
  Route,
  Clock,
  Dumbbell,
  ShoppingBag,
  Coffee,
  Utensils,
  Building2,
  Home as HomeIcon,
  MapPin,
  TrendingUp,
  Award,
  Sparkles,
  Download,
} from 'lucide-react';

export default function DashboardModal({
  isOpen,
  onClose,
  places,
  schedules,
  weeklyStats,
}) {
  const [activeTab, setActiveTab] = useState('commute'); // 'commute' | 'locations'

  if (!isOpen) return null;

  const daysOfWeek = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
  ];

  // Helper to format duration to human-readable format
  const formatDuration = (mins) => {
    if (mins === 0) return '0 mins';
    const hrs = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return hrs > 0 ? `${hrs}h ${m}m` : `${m} mins`;
  };

  // Helper to get location icon
  const getLocationIcon = (type, size = 16) => {
    switch (type) {
      case 'home': return <HomeIcon size={size} />;
      case 'office': return <Building2 size={size} />;
      case 'exercise': return <Dumbbell size={size} />;
      case 'activities': return <Sparkles size={size} />;
      case 'shopping': return <ShoppingBag size={size} />;
      case 'third_place': return <Coffee size={size} />;
      case 'eatery': return <Utensils size={size} />;
      default: return <MapPin size={size} />;
    }
  };

  // Helper to get location type labels
  const typeLabels = {
    home: 'Home',
    office: 'Office',
    exercise: 'Exercise Spot',
    activities: "Morgan's Activities",
    shopping: 'Shopping',
    third_place: 'Third Place',
    eatery: 'Eatery',
    other: 'Saved Place',
  };

  // --- Calculations ---
  
  // 1. Commute Calculations
  let totalDistance = 0;
  let totalDuration = 0;
  let activeDaysCount = 0;
  let totalStopsCount = 0;

  daysOfWeek.forEach((day) => {
    const stats = weeklyStats[day.key] || { distance: 0, duration: 0 };
    totalDistance += stats.distance;
    totalDuration += stats.duration;

    const stops = schedules[day.key] || [];
    if (stops.length > 0) {
      activeDaysCount += 1;
      totalStopsCount += stops.length;
    }
  });

  const avgDailyDistance = activeDaysCount > 0 ? totalDistance / activeDaysCount : 0;
  const avgDailyDuration = activeDaysCount > 0 ? totalDuration / activeDaysCount : 0;

  // 2. Location Summary Calculations
  const locationStats = places.map((place) => {
    let visitCount = 0;
    let totalStayTime = 0;

    daysOfWeek.forEach((day) => {
      const stops = schedules[day.key] || [];
      stops.forEach((stop) => {
        if (stop.placeId === place.id) {
          visitCount += 1;
          totalStayTime += stop.stayDuration || 0;
        }
      });
    });

    return {
      ...place,
      visitCount,
      totalStayTime,
    };
  });

  // Sort locations: most visited first, then by stay time
  const sortedLocations = [...locationStats].sort((a, b) => {
    if (b.visitCount !== a.visitCount) {
      return b.visitCount - a.visitCount;
    }
    return b.totalStayTime - a.totalStayTime;
  });

  const maxTotalStayTime = Math.max(...locationStats.map((l) => l.totalStayTime), 1);
  const maxVisitsCount = Math.max(...locationStats.map((l) => l.visitCount), 1);

  // SVG Chart Dimensions
  const chartHeight = 140;
  const chartWidth = 520;
  const maxDayDistance = Math.max(...daysOfWeek.map(d => (weeklyStats[d.key]?.distance || 0)), 10);

  const handleExportCSV = () => {
    const headers = ['Place Name', 'Type', 'Address', 'Visits per Week', 'Total Stay Time (mins)'];
    const rows = sortedLocations.map(l => [
      l.name,
      typeLabels[l.type] || l.type,
      l.address,
      l.visitCount,
      l.totalStayTime,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `commute_analytics_summary.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="analytics-modal-backdrop">
      <div className="analytics-modal-window">
        {/* Header */}
        <div className="analytics-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <TrendingUp size={22} className="analytics-header-icon" />
            <div>
              <h2>Weekly Commute Insights</h2>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                Visual metrics and stay stats for your schedules
              </p>
            </div>
          </div>
          <button className="analytics-close-btn" onClick={onClose} title="Close Dashboard">
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="analytics-tab-bar">
          <button
            className={`analytics-tab-btn ${activeTab === 'commute' ? 'active' : ''}`}
            onClick={() => setActiveTab('commute')}
          >
            <Route size={15} />
            Commute Summary
          </button>
          <button
            className={`analytics-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            <MapPin size={15} />
            Location Insights
          </button>

          <button 
            className="analytics-export-btn" 
            onClick={handleExportCSV}
            title="Download location stats CSV"
          >
            <Download size={13} />
            Export Data
          </button>
        </div>

        {/* Tab Contents */}
        <div className="analytics-modal-content">
          {activeTab === 'commute' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Stat Cards Grid */}
              <div className="analytics-stats-grid">
                <div className="analytics-stat-card">
                  <div className="stat-card-title">Total Distance</div>
                  <div className="stat-card-value">{totalDistance.toFixed(1)} <span className="stat-unit">mi</span></div>
                  <div className="stat-card-desc">Driven this week</div>
                </div>

                <div className="analytics-stat-card">
                  <div className="stat-card-title">Total Driving Time</div>
                  <div className="stat-card-value">{formatDuration(totalDuration)}</div>
                  <div className="stat-card-desc">Spent on routes</div>
                </div>

                <div className="analytics-stat-card">
                  <div className="stat-card-title">Daily Average</div>
                  <div className="stat-card-value">{avgDailyDistance.toFixed(1)} <span className="stat-unit">mi</span></div>
                  <div className="stat-card-desc">Across {activeDaysCount} active days</div>
                </div>

                <div className="analytics-stat-card">
                  <div className="stat-card-title">Stops Made</div>
                  <div className="stat-card-value">{totalStopsCount} <span className="stat-unit">stops</span></div>
                  <div className="stat-card-desc">Scheduled stops</div>
                </div>
              </div>

              {/* Chart Card */}
              <div className="analytics-chart-card">
                <div className="chart-card-header">
                  <h3>Daily Driving Distance (Miles)</h3>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    Peak distance: {maxDayDistance.toFixed(1)} miles
                  </span>
                </div>

                <div className="chart-svg-container">
                  <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} width="100%" height="100%">
                    {/* Y-Axis Guidelines */}
                    <line x1="40" y1="20" x2={chartWidth - 20} y2="20" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="40" y1="70" x2={chartWidth - 20} y2="70" stroke="var(--border-color)" strokeWidth="1" strokeDasharray="4 4" />
                    <line x1="40" y1="120" x2={chartWidth - 20} y2="120" stroke="var(--border-color)" strokeWidth="1" />

                    {/* Y-Axis Labels */}
                    <text x="30" y="24" fill="var(--text-muted)" fontSize="9" textAnchor="end">{maxDayDistance.toFixed(0)}m</text>
                    <text x="30" y="74" fill="var(--text-muted)" fontSize="9" textAnchor="end">{(maxDayDistance / 2).toFixed(0)}m</text>
                    <text x="30" y="124" fill="var(--text-muted)" fontSize="9" textAnchor="end">0m</text>

                    {/* Bars */}
                    {daysOfWeek.map((day, idx) => {
                      const dist = weeklyStats[day.key]?.distance || 0;
                      const duration = weeklyStats[day.key]?.duration || 0;
                      const hasStops = (schedules[day.key] || []).length > 0;
                      
                      const barWidth = 32;
                      const gap = (chartWidth - 60 - daysOfWeek.length * barWidth) / (daysOfWeek.length - 1);
                      const x = 50 + idx * (barWidth + gap);
                      const barHeight = (dist / maxDayDistance) * 100;
                      const y = 120 - barHeight;

                      return (
                        <g key={day.key} className="chart-bar-group">
                          <title>{`${day.label}: ${dist.toFixed(1)} miles, ${formatDuration(duration)} drive`}</title>
                          {/* Main bar background track */}
                          <rect x={x} y="20" width={barWidth} height="100" rx="4" fill="transparent" className="bar-interactive-zone" />
                          
                          {/* Value Bar */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={Math.max(barHeight, 3)}
                            rx="4"
                            className={`chart-svg-bar ${hasStops ? 'has-data' : 'empty'}`}
                            fill={hasStops ? 'var(--primary)' : 'var(--border-color)'}
                          />

                          {/* Day Label */}
                          <text
                            x={x + barWidth / 2}
                            y="136"
                            fill={hasStops ? 'var(--text-primary)' : 'var(--text-muted)'}
                            fontSize="9"
                            fontWeight="600"
                            textAnchor="middle"
                          >
                            {day.short}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Day Breakdown Cards */}
              <div className="analytics-day-cards">
                {daysOfWeek.map((day) => {
                  const stats = weeklyStats[day.key] || { distance: 0, duration: 0 };
                  const stopsCount = (schedules[day.key] || []).length;
                  const isActive = stopsCount > 0;

                  return (
                    <div key={day.key} className={`day-mini-card ${isActive ? 'active' : 'inactive'}`}>
                      <div className="day-mini-header">
                        <h4>{day.label}</h4>
                        <span className={`day-mini-badge ${isActive ? 'active' : 'inactive'}`}>
                          {isActive ? `${stopsCount} stops` : 'Rest day'}
                        </span>
                      </div>
                      <div className="day-mini-body">
                        <div>
                          <span className="day-stat-lbl">Distance:</span>
                          <span className="day-stat-val">{stats.distance.toFixed(1)} mi</span>
                        </div>
                        <div>
                          <span className="day-stat-lbl">Driving:</span>
                          <span className="day-stat-val">{stats.duration > 0 ? formatDuration(stats.duration) : '--'}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="analytics-locations-tab">
              {/* Leaderboard Section */}
              <div className="insights-card">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                  <Award size={18} style={{ color: 'var(--warning)' }} />
                  <h3>Most Visited Locations</h3>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {sortedLocations.slice(0, 5).map((loc, idx) => {
                    const relativeTimePct = (loc.totalStayTime / maxTotalStayTime) * 100;
                    
                    return (
                      <div key={loc.id} className="insight-location-row">
                        <div className="insight-row-left">
                          <span className="insight-row-rank">#{idx + 1}</span>
                          <div className={`place-icon-badge ${loc.type || 'other'}`} style={{ width: '28px', height: '28px', borderRadius: '6px' }}>
                            {getLocationIcon(loc.type, 14)}
                          </div>
                          <div className="insight-row-details">
                            <div className="insight-row-name">{loc.name}</div>
                            <div className="insight-row-address">{loc.address.split(',')[0]}</div>
                          </div>
                        </div>

                        <div className="insight-row-right">
                          <div className="insight-row-metrics">
                            <div className="visits-metric">{loc.visitCount} visits/wk</div>
                            <div className="duration-metric">{formatDuration(loc.totalStayTime)}</div>
                          </div>
                          <div className="insight-bar-track">
                            <div 
                              className={`insight-bar-fill ${loc.type || 'other'}`} 
                              style={{ width: `${Math.max(relativeTimePct, 4)}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Location Grid List */}
              <div className="analytics-locations-grid">
                {sortedLocations.map((loc) => (
                  <div key={loc.id} className="analytics-loc-card">
                    <div className="analytics-loc-header">
                      <div className={`place-icon-badge ${loc.type || 'other'}`}>
                        {getLocationIcon(loc.type, 15)}
                      </div>
                      <div style={{ minWidth: 0, flexGrow: 1 }}>
                        <h4 className="loc-card-title">{loc.name}</h4>
                        <span className="loc-card-subtitle">{typeLabels[loc.type] || 'Place'}</span>
                      </div>
                    </div>

                    <div className="analytics-loc-stats">
                      <div className="loc-mini-stat">
                        <span className="loc-mini-lbl">Visits</span>
                        <span className="loc-mini-val">{loc.visitCount} / week</span>
                      </div>
                      <div className="loc-mini-stat">
                        <span className="loc-mini-lbl">Time Spent</span>
                        <span className="loc-mini-val">{formatDuration(loc.totalStayTime)}</span>
                      </div>
                    </div>

                    <div className="loc-address-footer" title={loc.address}>
                      {loc.address}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
