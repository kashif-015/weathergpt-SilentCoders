import { useCallback, useEffect, useState } from 'react';
import { getActiveAlerts, getDashboard, getDashboardForecast } from '../services/dashboardService.js';
import WeatherIcon from './WeatherIcon.jsx';
import {
  Thermometer,
  Flame,
  Droplets,
  Wind,
  CloudRain,
  Eye,
  Compass,
  Sunrise,
  Sun,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

const severityLabel = { yellow: 'Watch', orange: 'Alert', red: 'Danger', green: 'Clear' };
const fmtTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
const fmtHour = (value) => new Date(value).toLocaleTimeString([], { hour: 'numeric' });
const fmtDay = (value) => new Date(`${value}T12:00:00`).toLocaleDateString([], { weekday: 'short' });

function MetricCard({ icon, label, item, detail, children }) {
  return (
    <article className="metric-card">
      <div className="metric-card__top">
        <span className="metric-card__icon">{icon}</span>
        <span className="metric-card__source" title={`Source: ${item?.source || 'Open-Meteo'}`}>
          {item?.source === 'IMD' ? 'IMD' : 'OM'}
        </span>
      </div>
      <div className="metric-card__value">{item?.value ?? '—'}<small>{item?.unit}</small></div>
      <div className="metric-card__label">{label}</div>
      {detail && <div className="metric-card__detail">{detail}</div>}
      {children}
    </article>
  );
}

function SunArc({ sun }) {
  const start = new Date(sun.sunrise).getTime(), end = new Date(sun.sunset).getTime();
  const progress = Math.max(0, Math.min(1, (Date.now() - start) / (end - start)));
  return (
    <article className="metric-card sun-card">
      <div className="metric-card__top">
        <span className="metric-card__icon"><Sunrise size={20} color="#f59e0b" /></span>
        <span className="metric-card__source">OM</span>
      </div>
      <div className="sun-arc">
        <div className="sun-arc__line"/>
        <span className="sun-arc__sun" style={{ left: `${8 + progress * 84}%` }}>
          <Sun size={18} color="#fbbf24" />
        </span>
      </div>
      <div className="sun-card__times">
        <span>{fmtTime(sun.sunrise)}</span>
        <span>{fmtTime(sun.sunset)}</span>
      </div>
      <div className="metric-card__label">Daylight</div>
    </article>
  );
}

function AlertStrip({ alerts, location }) {
  const [selected, setSelected] = useState(null);
  return (
    <>
      <section className={`alert-strip ${alerts.length ? '' : 'alert-strip--clear'}`}>
        {alerts.length ? (
          alerts.map((alert) => (
            <button key={alert.id} className={`alert-chip alert-chip--${alert.severity}`} onClick={() => setSelected(alert)}>
              <WeatherIcon icon={alert.icon} size={14} style={{ marginRight: 4 }} />
              {alert.hazard} <b>{severityLabel[alert.severity]}</b>
            </button>
          ))
        ) : (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <ShieldCheck size={16} color="#10b981" /> No active weather alerts for {location}
          </span>
        )}
      </section>
      {selected && (
        <div className="alert-detail" role="dialog">
          <button className="alert-detail__close" onClick={() => setSelected(null)}>×</button>
          <div className={`alert-detail__badge alert-chip--${selected.severity}`}>
            <WeatherIcon icon={selected.icon} size={16} style={{ marginRight: 6 }} />
            {severityLabel[selected.severity]}
          </div>
          <h2>{selected.hazard}</h2>
          <p>{selected.summary}</p>
          <p className="alert-detail__source">Source: {selected.source}</p>
          <button className="alert-detail__action" onClick={() => setSelected(null)}>I understand — stay safe</button>
        </div>
      )}
    </>
  );
}

function Forecast({ forecast }) {
  const temps = forecast.daily.flatMap((day) => [day.minTemp, day.maxTemp]);
  const min = Math.min(...temps), span = Math.max(1, Math.max(...temps) - min);
  return (
    <section className="forecast-panel">
      <div className="section-heading">
        <span>Next 24 hours</span>
        <small>Rain probability · wind</small>
      </div>
      <div className="hourly-strip">
        {forecast.hourly.map((hour) => (
          <div className="hourly-cell" key={hour.time}>
            <b>{fmtHour(hour.time)}</b>
            <span className="hourly-cell__icon">
              <WeatherIcon icon={hour.icon} size={20} />
            </span>
            <strong>{hour.temp}°</strong>
            <small style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Droplets size={11} /> {hour.rainProbability}%
            </small>
            <small className="hourly-cell__wind" style={{ '--direction': `${hour.windDirection}deg` }}>
              ↑ {hour.windSpeed}
            </small>
          </div>
        ))}
      </div>
      <div className="section-heading">
        <span>7-day outlook</span>
        <small>Source: {forecast.sources.daily}</small>
      </div>
      <div className="daily-list">
        {forecast.daily.map((day) => (
          <div className="day-row" key={day.date}>
            <b>{fmtDay(day.date)}</b>
            <span>
              <WeatherIcon icon={day.icon} size={20} />
            </span>
            <span className="day-row__temp">{day.maxTemp}° <i>{day.minTemp}°</i></span>
            <div className="range-track">
              <span style={{ left: `${((day.minTemp - min) / span) * 100}%`, width: `${((day.maxTemp - day.minTemp) / span) * 100}%` }}/>
            </div>
            <small style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <Droplets size={11} /> {day.rainProbability}%
            </small>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function WeatherDashboard({ location, onBackToChat }) {
  const [state, setState] = useState({ loading: true, error: '', current: null, forecast: null, alerts: [] });
  const load = useCallback(async () => {
    if (!location?.lat) return;
    setState((old) => ({ ...old, loading: !old.current, error: '' }));
    try {
      const [current, forecast, alertData] = await Promise.all([
        getDashboard(location.lat, location.lon),
        getDashboardForecast(location.lat, location.lon),
        getActiveAlerts(location.lat, location.lon)
      ]);
      setState({ loading: false, error: '', current, forecast, alerts: alertData.alerts || [] });
    } catch (error) {
      setState((old) => ({ ...old, loading: false, error: error.message }));
    }
  }, [location]);

  useEffect(() => {
    load();
    const timer = setInterval(load, 10 * 60_000);
    return () => clearInterval(timer);
  }, [load]);

  if (!location) return <main className="dashboard"><div className="dashboard__empty">Locating your weather station…</div></main>;
  const c = state.current;

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <p className="eyebrow">LIVE CONDITIONS</p>
          <h1>{location.name || location.city}</h1>
          <p className="dashboard__condition" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {c ? (
              <>
                <WeatherIcon icon={c.condition.icon} code={c.condition.code} size={22} />
                <span>{c.condition.label}</span>
              </>
            ) : 'Connecting to weather services…'}
          </p>
        </div>
        <div className="dashboard__actions">
          <button onClick={load} className="dashboard__refresh" disabled={state.loading}>↻ Refresh</button>
          <button onClick={onBackToChat} className="dashboard__chat">Open chat →</button>
        </div>
      </header>
      {state.error && <div className="dashboard__error">{state.error}</div>}
      {c && (
        <>
          <AlertStrip alerts={state.alerts} location={location.name || location.city}/>
          <section className="metric-grid">
            <MetricCard icon={<Thermometer size={20} color="#f59e0b" />} label="Temperature" item={c.temperature}/>
            <MetricCard icon={<Flame size={20} color="#ef4444" />} label="Feels like" item={c.feelsLike}/>
            <MetricCard icon={<Droplets size={20} color="#3b82f6" />} label="Humidity" item={c.humidity}/>
            <MetricCard icon={<Wind size={20} color="#10b981" />} label={`Wind · ${c.windDirection.compass}`} item={c.windSpeed}>
              <span className="compass-arrow" style={{ transform: `rotate(${c.windDirection.value}deg)` }}>↑</span>
            </MetricCard>
            <MetricCard icon={<CloudRain size={20} color="#60a5fa" />} label="Rainfall" item={c.rainfall} detail="Current precipitation"/>
            <MetricCard icon={<Eye size={20} color="#8b5cf6" />} label="Visibility" item={c.visibility}/>
            <MetricCard
              icon={<Compass size={20} color="#06b6d4" />}
              label="Pressure"
              item={c.pressure}
              detail={c.pressure.trend === 'rising' ? '↑ rising over 3 hours' : c.pressure.trend === 'falling' ? '↓ falling over 3 hours' : '→ steady over 3 hours'}
            />
            <SunArc sun={c.sun}/>
          </section>
          {state.forecast && <Forecast forecast={state.forecast}/>}
          <p className="dashboard__footnote">Field-level source labels: IMD is preferred when a station/district mapping is available; Open-Meteo fills missing point-level fields. Auto-refreshes every 10 minutes.</p>
        </>
      )}
    </main>
  );
}
