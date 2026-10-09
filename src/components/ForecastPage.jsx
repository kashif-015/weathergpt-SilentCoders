import { useState, useEffect, useCallback, useRef } from 'react';
import { getDashboard, getDashboardForecast, getActiveAlerts } from '../services/dashboardService.js';
import { getCurrentWeather, getForecast } from '../services/weatherService.js';
import WeatherAnimation from './WeatherAnimation.jsx';
import WeatherIcon from './WeatherIcon.jsx';
import {
  AlertTriangle,
  Droplets,
  CloudRain,
  Sun,
  Flame,
  Thermometer,
  Wind,
  ShieldAlert
} from 'lucide-react';

const fmtTime = (val) => val ? new Date(val).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—';
const fmtHour = (val) => {
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? val : d.toLocaleTimeString([], { hour: 'numeric', hour12: true });
  } catch {
    return val;
  }
};
const fmtDay = (val) => {
  try {
    const d = new Date(`${val}T12:00:00`);
    return isNaN(d.getTime()) ? val : d.toLocaleDateString([], { weekday: 'short' });
  } catch {
    return val;
  }
};
const fmtDateShort = (val) => {
  try {
    const d = new Date(`${val}T12:00:00`);
    return isNaN(d.getTime()) ? '' : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
};

export default function ForecastPage({ location, onBackToChat }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [current, setCurrent] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('hourly'); // 'hourly' | 'daily'
  const [heroAnimPreview, setHeroAnimPreview] = useState(null);

  // Drag-to-scroll + wheel→horizontal scroll
  const hourlyScrollRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragScrollStart = useRef(0);

  const onScrollMouseDown = useCallback((e) => {
    const el = hourlyScrollRef.current;
    if (!el) return;
    isDragging.current = true;
    dragStartX.current = e.pageX - el.offsetLeft;
    dragScrollStart.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
  }, []);
  const onScrollMouseMove = useCallback((e) => {
    if (!isDragging.current || !hourlyScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - hourlyScrollRef.current.offsetLeft;
    hourlyScrollRef.current.scrollLeft = dragScrollStart.current - (x - dragStartX.current);
  }, []);
  const onScrollMouseUp = useCallback(() => {
    isDragging.current = false;
    if (hourlyScrollRef.current) hourlyScrollRef.current.style.cursor = 'grab';
  }, []);

  useEffect(() => {
    const el = hourlyScrollRef.current;
    if (!el) return;
    const handleWheel = (e) => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  });


  const handleCycleHeroAnim = () => {
    const types = [null, 'sunny', 'partly-cloudy', 'cloudy', 'overcast', 'light-rain', 'heavy-rain', 'thunderstorm', 'fog', 'snow', 'clear-night', 'sunrise', 'sunset'];
    const idx = types.indexOf(heroAnimPreview);
    setHeroAnimPreview(types[(idx + 1) % types.length]);
  };

  const loadData = useCallback(async () => {
    if (!location?.lat || !location?.lon) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Primary: attempt dashboardService endpoints
      const [currData, foreData, alertData] = await Promise.allSettled([
        getDashboard(location.lat, location.lon),
        getDashboardForecast(location.lat, location.lon),
        getActiveAlerts(location.lat, location.lon)
      ]);

      let c = currData.status === 'fulfilled' ? currData.value : null;
      let f = foreData.status === 'fulfilled' ? foreData.value : null;
      let a = alertData.status === 'fulfilled' ? alertData.value?.alerts || [] : [];

      // Fallback: if dashboard service failed, attempt direct weatherService
      if (!c || !f) {
        const [fallbackCurr, fallbackFore] = await Promise.allSettled([
          getCurrentWeather(location.lat, location.lon),
          getForecast(location.lat, location.lon)
        ]);

        if (!c && fallbackCurr.status === 'fulfilled') {
          const fc = fallbackCurr.value;
          c = {
            condition: { label: fc.description, icon: fc.icon, code: fc.weatherCode },
            temperature: { value: Math.round(fc.temp), unit: '°C' },
            feelsLike: { value: Math.round(fc.feelsLike ?? fc.temp), unit: '°C' },
            humidity: { value: fc.humidity, unit: '%' },
            windSpeed: { value: fc.windSpeed, unit: 'km/h' },
            rainfall: { value: fc.precipitation ?? 0, unit: 'mm' },
            pressure: { value: 1013, unit: 'hPa' },
            visibility: { value: 10, unit: 'km' },
            observedAt: fc.time
          };
        }

        if (!f && fallbackFore.status === 'fulfilled') {
          const ff = fallbackFore.value;
          f = {
            hourly: [],
            daily: ff.map(d => ({
              date: d.date,
              icon: d.icon,
              maxTemp: d.maxTemp,
              minTemp: d.minTemp,
              rainProbability: Math.round(d.precipitation ? Math.min(100, d.precipitation * 10) : 0)
            })),
            sources: { daily: 'Open-Meteo' }
          };
        }
      }

      if (!c && !f) {
        throw new Error('Unable to retrieve forecast data at this moment.');
      }

      setCurrent(c);
      setForecast(f);
      setAlerts(a);
    } catch (err) {
      console.error('Forecast load error:', err);
      setError(err.message || 'Failed to load weather forecast.');
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10 * 60_000);
    return () => clearInterval(interval);
  }, [loadData]);

  if (loading && !current) {
    return (
      <div className="forecast-page">
        {onBackToChat && (
          <button className="forecast-page__back" onClick={onBackToChat}>
            ← Back to Chat
          </button>
        )}
        <div className="forecast-skeleton">
          <div className="forecast-skeleton__hero" />
          <div className="forecast-skeleton__strip" />
          <div className="forecast-skeleton__strip" />
        </div>
      </div>
    );
  }

  if (error && !current) {
    return (
      <div className="forecast-page">
        {onBackToChat && (
          <button className="forecast-page__back" onClick={onBackToChat}>
            ← Back to Chat
          </button>
        )}
        <div className="forecast-error">
          <div className="forecast-error__icon">
            <AlertTriangle size={36} color="var(--color-warning, #f59e0b)" />
          </div>
          <p className="forecast-error__text">{error}</p>
          <button className="forecast-error__retry" onClick={loadData}>
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Calculate temperature min/span for daily visualization
  const dailyTemps = forecast?.daily?.flatMap(d => [d.minTemp, d.maxTemp]) || [15, 30];
  const minDailyTemp = Math.min(...dailyTemps);
  const maxDailyTemp = Math.max(...dailyTemps);
  const tempSpan = Math.max(1, maxDailyTemp - minDailyTemp);

  // Generate smart AI weather insights based on real data
  const insights = [];
  if (current) {
    const tempVal = current.temperature?.value ?? 25;
    const humVal = current.humidity?.value ?? 50;
    const windVal = current.windSpeed?.value ?? 10;
    const rainVal = current.rainfall?.value ?? 0;

    if (rainVal > 0 || (forecast?.daily?.[0]?.rainProbability ?? 0) > 40) {
      insights.push({
        icon: <CloudRain size={22} color="#60a5fa" />,
        text: <><strong>Precipitation Advisory:</strong> Rain or showers expected. Carry an umbrella and plan outdoor travel during drier intervals.</>
      });
    } else {
      insights.push({
        icon: <Sun size={22} color="#f59e0b" />,
        text: <><strong>Favorable Outdoor Conditions:</strong> Minimal rain anticipated today. Ideal window for commuting, agriculture, or outdoor activities.</>
      });
    }

    if (tempVal > 35) {
      insights.push({
        icon: <Flame size={22} color="#ef4444" />,
        text: <><strong>High Heat Index:</strong> Temperatures around {tempVal}°C. Stay hydrated and avoid prolonged midday sun exposure.</>
      });
    } else if (tempVal < 12) {
      insights.push({
        icon: <Thermometer size={22} color="#38bdf8" />,
        text: <><strong>Brisk Temperatures:</strong> Cooler ambient air at {tempVal}°C. Warmer layers recommended during morning and night hours.</>
      });
    } else {
      insights.push({
        icon: <Wind size={22} color="#10b981" />,
        text: <><strong>Comfortable Thermal Range:</strong> Moderate temperatures ({tempVal}°C) with humidity at {humVal}%, offering pleasant conditions.</>
      });
    }

    if (windVal > 25) {
      insights.push({
        icon: <Wind size={22} color="#a855f7" />,
        text: <><strong>Breezy Winds:</strong> Wind speeds at {windVal} km/h. Secure loose outdoor fixtures.</>
      });
    }

    if (alerts.length > 0) {
      insights.push({
        icon: <ShieldAlert size={22} color="#ef4444" />,
        text: <><strong>Active Alert:</strong> {alerts[0].hazard} ({alerts[0].severity?.toUpperCase()}) reported nearby. Review official emergency advisories.</>
      });
    }
  }

  return (
    <div className="forecast-page">
      {onBackToChat && (
        <button className="forecast-page__back" onClick={onBackToChat}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6"/>
          </svg>
          Back to Chat
        </button>
      )}

      {/* Current Weather Hero */}
      {current && (
        <section className="forecast-hero" aria-label="Current Weather Conditions">
          <WeatherAnimation weather={current} type={heroAnimPreview} />
          <div className="forecast-hero__overlay" />
          <div className="forecast-hero__content">
            <div className="forecast-hero__location">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{location?.name || location?.city || 'Selected Location'}</span>
              <span style={{ opacity: 0.5 }}>· Live Conditions</span>
              <button
                type="button"
                className="rp-anim-pill"
                onClick={handleCycleHeroAnim}
                title={heroAnimPreview ? `Previewing: ${heroAnimPreview} (click to cycle or return to Live)` : 'Live weather animation (click to preview all 12 animations)'}
                aria-label="Cycle weather animation"
                style={{ marginLeft: '8px' }}
              >
                <span className={`rp-anim-pill__dot ${heroAnimPreview ? 'rp-anim-pill__dot--preview' : ''}`} />
                <span>{heroAnimPreview ? heroAnimPreview.replace('-', ' ') : 'Live'}</span>
              </button>
            </div>

            <div className="forecast-hero__main">
              <div className="forecast-hero__temp-group">
                <span className="forecast-hero__icon">
                  <WeatherIcon
                    icon={current.condition?.icon}
                    code={current.condition?.code}
                    size={48}
                  />
                </span>
                <div className="forecast-hero__temp">
                  {current.temperature?.value ?? '—'}<small>{current.temperature?.unit || '°C'}</small>
                </div>
              </div>
              <div className="forecast-hero__condition">
                <div className="forecast-hero__desc">{current.condition?.label || 'Clear sky'}</div>
                <div className="forecast-hero__feels">
                  Feels like {current.feelsLike?.value ?? current.temperature?.value ?? '—'}{current.feelsLike?.unit || '°C'}
                </div>
                <div className="forecast-hero__updated">
                  Updated {fmtTime(Date.now())} · IMD & Open-Meteo
                </div>
              </div>
            </div>

            <div className="forecast-hero__metrics">
              <div className="forecast-metric">
                <span className="forecast-metric__label">Humidity</span>
                <span className="forecast-metric__value">{current.humidity?.value ?? '—'}<small>{current.humidity?.unit || '%'}</small></span>
              </div>
              <div className="forecast-metric">
                <span className="forecast-metric__label">Wind Speed</span>
                <span className="forecast-metric__value">{current.windSpeed?.value ?? '—'}<small>{current.windSpeed?.unit || 'km/h'}</small></span>
              </div>
              <div className="forecast-metric">
                <span className="forecast-metric__label">Precipitation</span>
                <span className="forecast-metric__value">{current.rainfall?.value ?? '0'}<small>{current.rainfall?.unit || 'mm'}</small></span>
              </div>
              <div className="forecast-metric">
                <span className="forecast-metric__label">Pressure</span>
                <span className="forecast-metric__value">{current.pressure?.value ?? '1013'}<small>{current.pressure?.unit || 'hPa'}</small></span>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Hourly Timeline */}
      {forecast?.hourly && forecast.hourly.length > 0 && (
        <section className="forecast-hourly" aria-label="Hourly Forecast">
          <h3 className="forecast-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            <span>Hourly Forecast</span>
            <span className="forecast-section-sub">Next 24 Hours</span>
          </h3>

          <div
            className="forecast-hourly__scroll"
            ref={hourlyScrollRef}
            onMouseDown={onScrollMouseDown}
            onMouseMove={onScrollMouseMove}
            onMouseUp={onScrollMouseUp}
            onMouseLeave={onScrollMouseUp}
          >
            {forecast.hourly.map((h, idx) => {
              const isNow = idx === 0;
              return (
                <div key={h.time || idx} className={`forecast-hour ${isNow ? 'forecast-hour--now' : ''}`}>
                  <span className="forecast-hour__time">{isNow ? 'Now' : fmtHour(h.time)}</span>
                  <span className="forecast-hour__icon">
                    <WeatherIcon icon={h.icon} size={22} />
                  </span>
                  <span className="forecast-hour__temp">{Math.round(h.temp)}°</span>
                  <span className="forecast-hour__rain">
                    <Droplets size={12} color="#38bdf8" style={{ verticalAlign: 'middle', marginRight: 2 }} />
                    {h.rainProbability ?? 0}%
                  </span>
                  <span className="forecast-hour__wind">{Math.round(h.windSpeed ?? 0)}k</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 7-Day Forecast */}
      {forecast?.daily && forecast.daily.length > 0 && (
        <section className="forecast-daily" aria-label="7-Day Outlook">
          <div style={{ padding: 'var(--sp-4) var(--sp-4) var(--sp-2)' }}>
            <h3 className="forecast-section-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
                <line x1="16" x2="16" y1="2" y2="6"/>
                <line x1="8" x2="8" y1="2" y2="6"/>
                <line x1="3" x2="21" y1="10" y2="10"/>
              </svg>
              <span>7-Day Outlook</span>
              <span className="forecast-section-sub">{forecast.sources?.daily || 'IMD / Open-Meteo'}</span>
            </h3>
          </div>

          <div className="forecast-daily__list">
            {forecast.daily.map((day, idx) => {
              const minP = ((day.minTemp - minDailyTemp) / tempSpan) * 100;
              const widthP = Math.max(8, ((day.maxTemp - day.minTemp) / tempSpan) * 100);
              return (
                <div key={day.date || idx} className="forecast-day-row">
                  <div>
                    <div className="forecast-day-row__name">{idx === 0 ? 'Today' : fmtDay(day.date)}</div>
                    <div className="forecast-day-row__date">{fmtDateShort(day.date)}</div>
                  </div>
                  <div className="forecast-day-row__icon">
                    <WeatherIcon icon={day.icon} size={22} />
                  </div>
                  <div className="forecast-day-row__bar">
                    <div
                      className="forecast-day-row__bar-fill"
                      style={{ left: `${Math.max(0, minP)}%`, width: `${Math.min(100 - minP, widthP)}%` }}
                    />
                  </div>
                  <div className="forecast-day-row__temps">
                    <span className="forecast-day-row__high">{Math.round(day.maxTemp)}°</span>
                    <span className="forecast-day-row__low">{Math.round(day.minTemp)}°</span>
                  </div>
                  <div className="forecast-day-row__rain">
                    <Droplets size={12} color="#38bdf8" style={{ verticalAlign: 'middle', marginRight: 2 }} />
                    {day.rainProbability ?? 0}%
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* AI Weather Insights */}
      {insights.length > 0 && (
        <section className="forecast-insights" aria-label="AI Weather Insights">
          <h3 className="forecast-section-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
            <span>Weather Intelligence & Advisory</span>
          </h3>
          <div className="forecast-insights__list">
            {insights.map((item, idx) => (
              <div key={idx} className="forecast-insight-item">
                <div className="forecast-insight-item__icon">{item.icon}</div>
                <div className="forecast-insight-item__text">{item.text}</div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
