import { useState } from 'react';
import { X, Path, MapPin, DownloadSimple, Trophy } from '@phosphor-icons/react';
import { DAYS_OF_WEEK } from '../constants/days';
import { getPlaceTypeLabel, getPlaceTypeColor } from '../constants/placeTypes';
import TypeDisc from './TypeDisc';

const formatDuration = (mins) => {
  if (!mins || mins < 1) return '0m';
  const hrs = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  if (hrs === 0) return `${m}m`;
  return m > 0 ? `${hrs}h ${m}m` : `${hrs}h`;
};

export default function DashboardModal({ isOpen, onClose, places, schedules, weeklyStats }) {
  const [activeTab, setActiveTab] = useState('commute');

  if (!isOpen) return null;

  const days = DAYS_OF_WEEK;

  // ---- Commute calculations ----
  let totalDistance = 0;
  let totalDuration = 0;
  let activeDaysCount = 0;
  let totalStopsCount = 0;
  days.forEach((day) => {
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

  // ---- Location calculations ----
  const locationStats = places.map((place) => {
    let visitCount = 0;
    let totalStayTime = 0;
    days.forEach((day) => {
      (schedules[day.key] || []).forEach((stop) => {
        if (stop.placeId === place.id) {
          visitCount += 1;
          totalStayTime += stop.stayDuration || 0;
        }
      });
    });
    return { ...place, visitCount, totalStayTime };
  });
  const sortedLocations = [...locationStats].sort(
    (a, b) => b.visitCount - a.visitCount || b.totalStayTime - a.totalStayTime
  );
  const maxTotalStayTime = Math.max(...locationStats.map((l) => l.totalStayTime), 1);
  const maxDayDistance = Math.max(...days.map((d) => weeklyStats[d.key]?.distance || 0), 5);

  const handleExportCSV = () => {
    const headers = ['Place Name', 'Type', 'Address', 'Visits per Week', 'Total Stay Time (mins)'];
    const rows = sortedLocations.map((l) => [
      l.name,
      getPlaceTypeLabel(l.type),
      l.address,
      l.visitCount,
      l.totalStayTime,
    ]);
    const csv =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.map((v) => `"${v}"`).join(','))].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csv));
    link.setAttribute('download', 'routeen_insights.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statCards = [
    { label: 'total distance', value: `${totalDistance.toFixed(1)} mi`, desc: 'driven this week' },
    { label: 'drive time', value: formatDuration(totalDuration), desc: 'behind the wheel' },
    {
      label: 'daily average',
      value: `${avgDailyDistance.toFixed(1)} mi`,
      desc: `across ${activeDaysCount} active days`,
    },
    { label: 'weekly stops', value: `${totalStopsCount}`, desc: 'scheduled stops' },
  ];

  return (
    <div className="analytics-modal-backdrop" onClick={onClose}>
      <div className="analytics-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="analytics-modal-header">
          <span className="jb-mark jb-mark--sm" style={{ width: 34, height: 34 }} />
          <div style={{ flex: 1 }}>
            <h2>weekly insights</h2>
            <p>how your week of driving really adds up</p>
          </div>
          <button className="analytics-close-btn" onClick={onClose} title="Close">
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Tabs */}
        <div className="analytics-tab-bar">
          <button
            className={`analytics-tab-btn ${activeTab === 'commute' ? 'active' : ''}`}
            onClick={() => setActiveTab('commute')}
          >
            <Path size={15} weight="bold" /> commute summary
          </button>
          <button
            className={`analytics-tab-btn ${activeTab === 'locations' ? 'active' : ''}`}
            onClick={() => setActiveTab('locations')}
          >
            <MapPin size={15} weight="bold" /> location insights
          </button>
          <button className="analytics-export-btn" onClick={handleExportCSV} title="Download CSV">
            <DownloadSimple size={14} weight="bold" /> export csv
          </button>
        </div>

        {/* Content */}
        <div className="analytics-modal-content rt-scroll">
          {activeTab === 'commute' ? (
            <>
              <div className="analytics-stats-grid">
                {statCards.map((c) => (
                  <div className="analytics-stat-card" key={c.label}>
                    <div className="stat-card-title">{c.label}</div>
                    <div className="stat-card-value">{c.value}</div>
                    <div className="stat-card-desc">{c.desc}</div>
                  </div>
                ))}
              </div>

              <div className="analytics-chart-card">
                <div className="chart-card-header">
                  <h3>daily driving distance</h3>
                  <span className="peak">peak {maxDayDistance.toFixed(1)} mi</span>
                </div>
                <div className="chart-bars">
                  {days.map((d) => {
                    const dist = weeklyStats[d.key]?.distance || 0;
                    const has = (schedules[d.key] || []).length > 0;
                    const heightPct = Math.max((dist / maxDayDistance) * 92, has ? 6 : 2);
                    return (
                      <div className="chart-bar-col" key={d.key}>
                        <div className="chart-bar-track">
                          <div
                            className="chart-bar-value"
                            style={{ color: has ? 'var(--candy-raspberry)' : 'transparent' }}
                          >
                            {dist > 0 ? dist.toFixed(0) : ''}
                          </div>
                          <div
                            className={`chart-bar ${has ? 'has-data' : 'empty'}`}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <div
                          className="chart-bar-label"
                          style={{ color: has ? 'var(--rt-ink)' : '#b7c4cc' }}
                        >
                          {d.short.toLowerCase()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="analytics-day-cards">
                {days.map((d) => {
                  const stats = weeklyStats[d.key] || { distance: 0, duration: 0 };
                  const count = (schedules[d.key] || []).length;
                  const has = count > 0;
                  return (
                    <div className={`day-mini-card ${has ? '' : 'inactive'}`} key={d.key}>
                      <h4>{d.short.toLowerCase()}</h4>
                      <div className={`day-mini-badge ${has ? 'active' : 'inactive'}`}>
                        {has ? `${count} stop${count === 1 ? '' : 's'}` : 'rest'}
                      </div>
                      <div className="day-mini-dist">{has ? `${stats.distance.toFixed(1)} mi` : '—'}</div>
                      <div className="day-mini-dur">{has ? formatDuration(stats.duration) : ''}</div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <div className="insights-card">
                <div className="insights-card-title">
                  <Trophy size={18} weight="fill" style={{ color: 'var(--candy-gold)' }} />
                  <h3>most-visited this week</h3>
                </div>
                <div className="leaderboard">
                  {sortedLocations.slice(0, 5).map((l, idx) => {
                    const color = getPlaceTypeColor(l.type);
                    const widthPct = Math.max((l.totalStayTime / maxTotalStayTime) * 100, 4);
                    return (
                      <div className="leaderboard-row" key={l.id}>
                        <span className="leaderboard-rank">#{idx + 1}</span>
                        <TypeDisc type={l.type} size={32} radius={10} iconSize={16} shadow="none" />
                        <div className="leaderboard-details">
                          <div className="leaderboard-nameline">
                            <span className="leaderboard-name">{l.name}</span>
                            <span className="leaderboard-metrics">
                              {l.visitCount}/wk · {formatDuration(l.totalStayTime)}
                            </span>
                          </div>
                          <div className="leaderboard-bar-track">
                            <div
                              className="leaderboard-bar-fill"
                              style={{ width: `${widthPct}%`, background: color }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="analytics-locations-grid">
                {sortedLocations.map((l) => (
                  <div className="analytics-loc-card" key={l.id}>
                    <div className="analytics-loc-header">
                      <TypeDisc type={l.type} size={36} radius={12} iconSize={16} shadow="none" />
                      <div style={{ minWidth: 0 }}>
                        <div className="loc-card-title">{l.name}</div>
                        <div className="loc-card-subtitle">{getPlaceTypeLabel(l.type).toLowerCase()}</div>
                      </div>
                    </div>
                    <div className="analytics-loc-stats">
                      <div className="loc-mini-stat">
                        <div className="loc-mini-lbl">visits</div>
                        <div className="loc-mini-val">{l.visitCount}/wk</div>
                      </div>
                      <div className="loc-mini-stat">
                        <div className="loc-mini-lbl">time</div>
                        <div className="loc-mini-val">{formatDuration(l.totalStayTime) || '0m'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
