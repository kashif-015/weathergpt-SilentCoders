import { useState, useEffect, useRef, useCallback } from 'react';
import InteractiveEarth from './InteractiveEarth.jsx';
import WeatherIcon from './WeatherIcon.jsx';
import {
  CloudSunRain,
  Calendar,
  Wheat,
  CloudRain,
  Globe,
  AlertTriangle,
  Zap,
  Cpu,
  ShieldAlert,
  Droplets
} from 'lucide-react';

const QUICK_PROMPTS = [
  { icon: CloudSunRain, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)', text: "What's the current weather in my city?" },
  { icon: Calendar, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)', text: 'Show me the 15-day IMD forecast' },
  { icon: Wheat, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', text: "How will today's weather affect crops?" },
  { icon: CloudRain, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', text: 'Will it rain today?' },
  { icon: Globe, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', text: 'Recent earthquakes near India?' },
  { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', text: 'Check active disaster alerts' },
];

const CAPABILITIES = [
  { icon: Zap, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', label: 'Real-time Weather' },
  { icon: Cpu, color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', label: 'AI Insights' },
  { icon: Globe, color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', label: 'Multilingual' },
  { icon: ShieldAlert, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', label: 'Disaster Ready' },
];

const DATA_SOURCES = ['IMD', 'NASA POWER', 'GDACS', 'USGS', 'Open-Meteo'];

// Hook for drag-to-scroll and wheel→horizontal-scroll
function useScrollDrag() {
  const ref = useRef(null);
  const isDragging = useRef(false);
  const startX = useRef(0);
  const scrollStart = useRef(0);

  const onMouseDown = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    isDragging.current = true;
    startX.current = e.pageX - el.offsetLeft;
    scrollStart.current = el.scrollLeft;
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  }, []);

  const onMouseMove = useCallback((e) => {
    if (!isDragging.current || !ref.current) return;
    e.preventDefault();
    const x = e.pageX - ref.current.offsetLeft;
    ref.current.scrollLeft = scrollStart.current - (x - startX.current);
  }, []);

  const onMouseUp = useCallback(() => {
    isDragging.current = false;
    if (ref.current) ref.current.style.cursor = 'grab';
  }, []);

  const onWheel = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    // Only intercept vertical wheel when there's horizontal overflow
    if (el.scrollWidth <= el.clientWidth) return;
    if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    }
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // passive: false so we can preventDefault on wheel
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  return {
    ref,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onMouseLeave: onMouseUp,
    }
  };
}

function HourlyForecastStrip({ location, onNavigateForecast }) {
  const [hours, setHours] = useState(null);
  const [loading, setLoading] = useState(true);
  const scroll = useScrollDrag();

  useEffect(() => {
    if (!location?.lat) return;
    setLoading(true);
    fetch(`/api/forecast?lat=${encodeURIComponent(location.lat)}&lon=${encodeURIComponent(location.lon)}`)
      .then(r => r.json())
      .then(data => {
        if (data?.data?.hourly) {
          setHours(data.data.hourly.slice(0, 12));
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [location]);

  if (loading) {
    return (
      <div className="hourly-forecast-strip">
        <div className="section-header">
          <h3>Today's Forecast</h3>
          <span className="section-header__sub">Hourly outlook</span>
        </div>
        <div className="hourly-scroll" ref={scroll.ref} {...scroll.handlers}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="hourly-item hourly-item--skeleton">
              <div className="skeleton skeleton--text" style={{ width: '32px' }} />
              <div className="skeleton skeleton--circle" />
              <div className="skeleton skeleton--text" style={{ width: '28px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!hours || hours.length === 0) return null;


  return (
    <div className="hourly-forecast-strip">
      <div className="section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h3>Today's Forecast</h3>
          <span className="section-header__sub">Hourly outlook</span>
        </div>
        {onNavigateForecast && (
          <button
            onClick={onNavigateForecast}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary-light)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            15-Day Weather Forecast →
          </button>
        )}
      </div>
      <div className="hourly-scroll" ref={scroll.ref} {...scroll.handlers}>
        {hours.map((h, i) => (
          <div
            key={i}
            className={`hourly-item ${i === 0 ? 'hourly-item--now' : ''}`}
            onClick={onNavigateForecast}
            style={{ cursor: onNavigateForecast ? 'pointer' : 'default' }}
            title="Click to view complete forecast"
          >
            <span className="hourly-item__time">
              {i === 0 ? 'Now' : new Date(h.time).toLocaleTimeString([], { hour: 'numeric' })}
            </span>
            <span className="hourly-item__icon">
              <WeatherIcon icon={h.icon} size={20} />
            </span>
            <span className="hourly-item__temp">{Math.round(h.temp)}°</span>
            {h.rainProbability > 0 && (
              <span className="hourly-item__rain">
                <Droplets size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />
                {h.rainProbability}%
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function WeatherRiskScore({ weather }) {
  if (!weather) return null;

  const getRisk = (value, thresholds) => {
    if (value >= thresholds[2]) return { level: 'high', percent: 90 };
    if (value >= thresholds[1]) return { level: 'moderate', percent: 60 };
    if (value >= thresholds[0]) return { level: 'low', percent: 30 };
    return { level: 'minimal', percent: 10 };
  };

  const heat = getRisk(weather.temp, [35, 38, 42]);
  const wind = getRisk(weather.windSpeed, [25, 40, 60]);
  const humidity = getRisk(weather.humidity, [70, 80, 90]);

  const overall = [heat, wind, humidity].reduce((max, r) =>
    r.percent > max.percent ? r : max, { level: 'minimal', percent: 10 }
  );

  const riskColor = {
    minimal: 'var(--color-success)',
    low: 'var(--color-success)',
    moderate: 'var(--color-warning)',
    high: 'var(--color-danger)'
  };

  return (
    <div className="risk-score-card">
      <div className="section-header">
        <h3>Weather Risk Assessment</h3>
        <span className={`risk-badge risk-badge--${overall.level}`}>
          {overall.level.toUpperCase()}
        </span>
      </div>
      <div className="risk-items">
        {[
          { label: 'Heat Risk', risk: heat },
          { label: 'Wind Risk', risk: wind },
          { label: 'Humidity Risk', risk: humidity },
        ].map((item, i) => (
          <div key={i} className="risk-item">
            <div className="risk-item__header">
              <span>{item.label}</span>
              <span className="risk-item__level">{item.risk.level}</span>
            </div>
            <div className="risk-item__track">
              <div
                className="risk-item__fill"
                style={{
                  width: `${item.risk.percent}%`,
                  background: riskColor[item.risk.level]
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomePage({ weather, location, onPromptClick, currentLang, onNavigateForecast, onNavigateAlerts }) {
  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero" aria-label="WeatherGPT hero">
        <div className="hero__content">
          <div className="hero__badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
            </svg>
            AI-Powered Weather Intelligence
          </div>
          <h2 className="hero__heading">
            Weather Insights.<br />
            <span className="hero__heading--gradient">A Safer Tomorrow.</span>
          </h2>
          <p className="hero__description">
            Get real-time weather, forecasts, disaster alerts and AI-powered insights
            from trusted sources — all in one place.
          </p>
          <div className="hero__capabilities">
            {CAPABILITIES.map((cap, i) => {
              const CapIcon = cap.icon;
              return (
                <div key={i} className="capability-badge">
                  <span className="capability-badge__icon" style={{ background: cap.bg, padding: '4px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CapIcon size={16} color={cap.color} />
                  </span>
                  <span>{cap.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="hero__visual">
          <InteractiveEarth location={location} weather={weather} />
        </div>
      </section>

      {/* Quick Prompts */}
      <section className="quick-prompts" aria-label="Quick actions">
        <div className="section-header">
          <h3>Try asking WeatherGPT...</h3>
        </div>
        <div className="prompts-grid">
          {QUICK_PROMPTS.map((prompt, i) => {
            const PromptIcon = prompt.icon;
            return (
              <button
                key={i}
                className="prompt-card"
                onClick={() => onPromptClick(prompt.text)}
                aria-label={prompt.text}
              >
                <span className="prompt-card__icon" style={{ background: prompt.bg, padding: '8px', borderRadius: '10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <PromptIcon size={18} color={prompt.color} />
                </span>
                <span className="prompt-card__text">{prompt.text}</span>
                <svg className="prompt-card__arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m9 18 6-6-6-6"/>
                </svg>
              </button>
            );
          })}
        </div>
      </section>

      {/* Hourly Forecast */}
      <HourlyForecastStrip location={location} onNavigateForecast={onNavigateForecast} />

      {/* Weather Risk Score */}
      <WeatherRiskScore weather={weather} />

      {/* AI Insight */}
      {weather && (
        <section className="ai-insight-card" aria-label="AI weather insight">
          <div className="ai-insight-card__header">
            <div className="ai-insight-card__title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
              </svg>
              WeatherGPT Insight
            </div>
            <div className="ai-insight-card__meta">
              <span className="source-pill">IMD + Open-Meteo</span>
              <span className="confidence-pill">High Confidence</span>
            </div>
          </div>
          <p className="ai-insight-card__text">
            {weather.temp >= 38
              ? `Heat advisory: Temperature is ${weather.temp}°C. Avoid outdoor exposure between 12–4 PM. Stay hydrated and seek shade.`
              : weather.humidity > 80
                ? `High humidity at ${weather.humidity}%. Expect muggy conditions. Rain is possible later today — carry an umbrella if heading out.`
                : weather.windSpeed > 30
                  ? `Windy conditions with speeds up to ${weather.windSpeed} km/h. Secure loose items outdoors and exercise caution near trees.`
                  : `Currently ${weather.temp}°C with ${weather.description?.toLowerCase() || 'fair skies'}. Conditions look favorable for outdoor activities. The safest window for travel is between 9 AM and 3 PM.`
            }
          </p>
        </section>
      )}

      {/* Data Sources */}
      <section className="data-sources" aria-label="Data sources">
        <span className="data-sources__label">Powered by trusted data sources</span>
        <div className="data-sources__list">
          {DATA_SOURCES.map((src, i) => (
            <span key={i} className="data-source-pill">{src}</span>
          ))}
        </div>
        <span className="data-sources__tagline">Accurate. Actionable. For a Safer Tomorrow.</span>
      </section>
    </div>
  );
}
