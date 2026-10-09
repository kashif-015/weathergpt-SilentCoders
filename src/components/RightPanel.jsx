import { useState, useEffect } from 'react';
import { getRecentEarthquakes } from '../services/weatherService.js';
import { getGdacsAlerts } from '../services/apiClients.js';
import WeatherAnimation from './WeatherAnimation.jsx';
import WeatherIcon from './WeatherIcon.jsx';
import { CheckCircle2, AlertTriangle, Activity } from 'lucide-react';

function CurrentWeatherCard({ weather, location }) {
  const [previewAnim, setPreviewAnim] = useState(null);

  const handleNextAnimation = () => {
    const types = [null, 'sunny', 'partly-cloudy', 'cloudy', 'overcast', 'light-rain', 'heavy-rain', 'thunderstorm', 'fog', 'snow', 'clear-night', 'sunrise', 'sunset'];
    const currentIndex = types.indexOf(previewAnim);
    setPreviewAnim(types[(currentIndex + 1) % types.length]);
  };

  if (!weather) {
    return (
      <div className="rp-card rp-weather-card">
        <div className="rp-card__header">
          <h3>Current Weather</h3>
        </div>
        <div className="rp-weather-card__skeleton">
          <div className="skeleton skeleton--block" style={{ height: '80px' }} />
          <div className="skeleton skeleton--text" style={{ width: '60%' }} />
          <div className="skeleton skeleton--text" style={{ width: '80%' }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rp-card rp-weather-card">
      <WeatherAnimation weather={weather} type={previewAnim} />
      <div className="rp-weather-card__overlay" />
      <div className="rp-weather-card__content">
        <div className="rp-card__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h3>Current Weather</h3>
            <button
              type="button"
              className="rp-anim-pill"
              onClick={handleNextAnimation}
              title={previewAnim ? `Previewing: ${previewAnim} (click to cycle or return to Live)` : 'Live weather animation (click to preview all 12 animations)'}
              aria-label="Cycle weather animation"
            >
              <span className={`rp-anim-pill__dot ${previewAnim ? 'rp-anim-pill__dot--preview' : ''}`} />
              <span>{previewAnim ? previewAnim.replace('-', ' ') : 'Live'}</span>
            </button>
          </div>
          {location && (
            <span className="rp-card__location">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              {location.city || location.name}
            </span>
          )}
        </div>
      <div className="rp-weather-card__main">
        <div className="rp-weather-card__temp-group">
          <span className="rp-weather-card__icon">
            <WeatherIcon icon={weather.icon} code={weather.weatherCode} size={36} />
          </span>
          <span className="rp-weather-card__temp">{weather.temp}°<small>C</small></span>
        </div>
        <div className="rp-weather-card__condition">
          <span className="rp-weather-card__desc">{weather.description}</span>
          <span className="rp-weather-card__feels">Feels like {weather.feelsLike}°C</span>
        </div>
      </div>
      <div className="rp-weather-card__stats">
        <div className="rp-stat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
          <div>
            <span className="rp-stat__label">Humidity</span>
            <span className="rp-stat__value">{weather.humidity}%</span>
          </div>
        </div>
        <div className="rp-stat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/></svg>
          <div>
            <span className="rp-stat__label">Wind</span>
            <span className="rp-stat__value">{weather.windSpeed} km/h</span>
          </div>
        </div>
        <div className="rp-stat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/></svg>
          <div>
            <span className="rp-stat__label">Pressure</span>
            <span className="rp-stat__value">{weather.pressure} hPa</span>
          </div>
        </div>
        <div className="rp-stat">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#06b6d4" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
          <div>
            <span className="rp-stat__label">Visibility</span>
            <span className="rp-stat__value">10 km</span>
          </div>
        </div>
      </div>
    </div>
  </div>
);
}

function MapPreview({ onNavigate }) {
  return (
    <div className="rp-card rp-map-card">
      <div className="rp-card__header">
        <h3>India Weather Map</h3>
        <button className="rp-card__action" onClick={onNavigate} title="Open full map" aria-label="Open full map">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 3h6v6M14 10l6.1-6.1M9 21H3v-6M10 14l-6.1 6.1"/>
          </svg>
        </button>
      </div>
      <div className="rp-map-card__preview">
        <div className="rp-map-card__visual">
          <div className="map-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
              <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/>
              <line x1="9" y1="3" x2="9" y2="18"/>
              <line x1="15" y1="6" x2="15" y2="21"/>
            </svg>
            <span>India Weather Radar</span>
          </div>
        </div>
        <div className="rp-map-card__legend">
          <span><i style={{background:'#ff4444'}}/>Heavy Rain</span>
          <span><i style={{background:'#ff9900'}}/>Moderate Rain</span>
          <span><i style={{background:'#44bb44'}}/>Light Rain</span>
          <span><i style={{background:'#888'}}/>Cloudy</span>
          <span><i style={{background:'#4488ff'}}/>Clear</span>
        </div>
      </div>
    </div>
  );
}

function AlertsPreview({ onNavigate }) {
  const [alerts, setAlerts] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const [gdacs, quakes] = await Promise.all([
          getGdacsAlerts(),
          getRecentEarthquakes(4.5),
        ]);
        const combined = [];

        if (gdacs?.alerts) {
          gdacs.alerts.slice(0, 2).forEach((a, i) => {
            combined.push({
              id: `gdacs-${i}`,
              severity: 'orange',
              icon: '🔴',
              title: a.title || 'Disaster Alert',
              region: a.description?.slice(0, 60) || 'Global',
              source: 'GDACS',
              time: a.updatedAt || a.pubDate ? timeAgo(new Date(a.updatedAt || a.pubDate)) : 'Recent',
            });
          });
        }

        if (quakes?.length) {
          quakes.slice(0, 2).forEach(q => {
            combined.push({
              id: q.id,
              severity: q.severity === 'severe' || q.severity === 'strong' ? 'red' : 'yellow',
              icon: '🔵',
              title: `M${q.magnitude.toFixed(1)} Earthquake`,
              region: q.place,
              source: 'USGS',
              time: timeAgo(new Date(q.time)),
            });
          });
        }

        setAlerts(combined.length > 0 ? combined.slice(0, 3) : []);
      } catch {
        setAlerts([]);
      } finally {
        setLoading(false);
      }
    };
    fetchAlerts();
  }, []);

  if (loading) {
    return (
      <div className="rp-card rp-alerts-card">
        <div className="rp-card__header">
          <h3>Latest Alerts</h3>
        </div>
        <div className="rp-alerts-card__list">
          {[1,2,3].map(i => (
            <div key={i} className="rp-alert-item rp-alert-item--skeleton">
              <div className="skeleton skeleton--circle" style={{width: '8px', height: '8px'}} />
              <div style={{flex:1}}>
                <div className="skeleton skeleton--text" style={{width:'70%'}} />
                <div className="skeleton skeleton--text" style={{width:'50%', marginTop:'4px'}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rp-card rp-alerts-card">
      <div className="rp-card__header">
        <h3>Latest Alerts</h3>
        <button className="rp-card__link" onClick={onNavigate}>
          View All <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
        </button>
      </div>
      <div className="rp-alerts-card__list">
        {alerts.length === 0 ? (
          <div className="rp-alerts-card__empty">
            <span className="rp-alerts-card__empty-icon">
              <CheckCircle2 size={20} color="var(--color-success, #10b981)" />
            </span>
            <span>All clear — no significant active alerts detected.</span>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className={`rp-alert-item rp-alert-item--${alert.severity}`}>
              <span className={`rp-alert-dot rp-alert-dot--${alert.severity}`} />
              <div className="rp-alert-item__content">
                <span className="rp-alert-item__title">{alert.title}</span>
                <span className="rp-alert-item__meta">
                  {alert.region?.slice(0, 40)} · {alert.source}
                </span>
              </div>
              <span className="rp-alert-item__time">{alert.time}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function timeAgo(date) {
  if (!date || isNaN(date.getTime())) return 'Recent';
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export default function RightPanel({ weather, location, onNavigateAlerts, onNavigateMaps }) {
  return (
    <aside className="right-panel" aria-label="Weather information panel">
      <CurrentWeatherCard weather={weather} location={location} />
      <MapPreview onNavigate={onNavigateMaps} />
      <AlertsPreview onNavigate={onNavigateAlerts} />
    </aside>
  );
}
