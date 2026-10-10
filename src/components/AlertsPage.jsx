import { useState, useEffect } from 'react';
import { getRecentEarthquakes, getIndiaEarthquakes } from '../services/weatherService.js';
import { getGdacsAlerts } from '../services/apiClients.js';
import {
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Radio,
  Activity,
  Flame,
  Globe2,
  MapPin,
  RefreshCw
} from 'lucide-react';

export default function AlertsPage({ location, currentLang = 'en', districtAlert, onBackToChat }) {
  const [alerts, setAlerts] = useState(null);
  const [quakes, setQuakes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const [showAllQuakes, setShowAllQuakes] = useState(false);

  const ALERT_LIMIT = 4;
  const QUAKE_LIMIT = 4;

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [gdacs, eq] = await Promise.all([
        getGdacsAlerts(),
        getIndiaEarthquakes().catch(() => []),
      ]);
      setAlerts(gdacs?.alerts || []);
      setQuakes(Array.isArray(eq) ? eq : []);
    } catch (e) {
      setError(
        currentLang === 'hi'
          ? 'आपदा अलर्ट डेटा प्राप्त करने में विफल। कृपया पुनः प्रयास करें।'
          : 'Failed to fetch alert data. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getAlertSeverityClass = (alert) => {
    const text = `${alert?.title || ''} ${alert?.description || ''}`.toLowerCase();
    if (text.includes('red') || text.includes('severe') || text.includes('extreme') || text.includes('emergency')) {
      return 'alert-list-item__indicator--red';
    }
    if (text.includes('orange') || text.includes('strong') || text.includes('moderate')) {
      return 'alert-list-item__indicator--orange';
    }
    if (text.includes('green') || text.includes('minor') || text.includes('advisory')) {
      return 'alert-list-item__indicator--green';
    }
    return 'alert-list-item__indicator--yellow';
  };

  const getAlertBadgeColor = (alert) => {
    const text = `${alert?.title || ''} ${alert?.description || ''}`.toLowerCase();
    if (text.includes('red') || text.includes('severe')) return { bg: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)' };
    if (text.includes('orange') || text.includes('strong')) return { bg: 'rgba(249, 115, 22, 0.12)', color: '#f97316', border: 'rgba(249, 115, 22, 0.3)' };
    if (text.includes('green') || text.includes('minor')) return { bg: 'rgba(16, 185, 129, 0.12)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' };
    return { bg: 'rgba(245, 158, 11, 0.12)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)' };
  };

  if (loading) {
    return (
      <div className="alerts-page">
        {onBackToChat && (
          <button
            className="forecast-page__back"
            onClick={onBackToChat}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              marginBottom: '16px',
              padding: '8px 14px',
              background: 'var(--surface-card, rgba(255, 255, 255, 0.05))',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m15 18-6-6 6-6" />
            </svg>
            {currentLang === 'hi' ? 'चैट पर वापस जाएं' : 'Back to Chat'}
          </button>
        )}
        <div className="alerts-page__header">
          <div className="alerts-page__title-row">
            <h2 className="alerts-page__title">
              <Radio size={24} color="#ef4444" />
              {currentLang === 'hi' ? 'आपदा चेतावनियां (Disaster Alerts)' : 'Disaster Alerts'}
            </h2>
          </div>
          <p className="alerts-page__subtitle">
            {currentLang === 'hi'
              ? 'GDACS, USGS और IMD से रीयल-टाइम लाइव अलर्ट'
              : 'Real-time alerts from GDACS, USGS and IMD'}
          </p>
        </div>
        <div className="skeleton-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton-card" style={{ marginBottom: '14px' }}>
              <div className="skeleton skeleton--text" style={{ width: '45%' }} />
              <div className="skeleton skeleton--text" style={{ width: '85%', marginTop: '10px' }} />
              <div className="skeleton skeleton--text" style={{ width: '30%', marginTop: '10px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const alertList = alerts || [];
  const quakeList = quakes || [];
  const displayedAlerts = showAllAlerts ? alertList : alertList.slice(0, ALERT_LIMIT);
  const displayedQuakes = showAllQuakes ? quakeList : quakeList.slice(0, QUAKE_LIMIT);

  return (
    <div className="alerts-page">
      {onBackToChat && (
        <button
          className="forecast-page__back"
          onClick={onBackToChat}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            marginBottom: '16px',
            padding: '8px 14px',
            background: 'var(--surface-card, rgba(255, 255, 255, 0.05))',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            color: 'var(--text-secondary)',
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m15 18-6-6 6-6" />
          </svg>
          {currentLang === 'hi' ? 'चैट पर वापस जाएं' : 'Back to Chat'}
        </button>
      )}

      {/* Header with Alignment and Stats Chips */}
      <div className="alerts-page__header">
        <div className="alerts-page__title-row">
          <h2 className="alerts-page__title">
            <Radio size={24} color="#ef4444" className="pulse-icon" />
            {currentLang === 'hi' ? 'आपदा चेतावनियां (Disaster Alerts)' : 'Disaster Alerts'}
          </h2>
          <button
            onClick={loadData}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
            title="Refresh alerts"
          >
            <RefreshCw size={13} />
            {currentLang === 'hi' ? 'रिफ्रेश' : 'Refresh'}
          </button>
        </div>
        <p className="alerts-page__subtitle">
          {currentLang === 'hi'
            ? 'GDACS, USGS एवं IMD द्वारा सत्यापित वैश्विक व राष्ट्रीय आपातकालीन चेतावनियां'
            : 'Real-time hazard monitoring from GDACS, USGS and IMD official feeds'}
        </p>

        {/* Top Summary Stat Chips */}
        <div className="alerts-page__chips">
          <span className="alerts-chip alerts-chip--highlight">
            <AlertTriangle size={13} />
            {alertList.length} {currentLang === 'hi' ? 'सक्रिय वैश्विक अलर्ट' : 'Active GDACS Alerts'}
          </span>
          <span className="alerts-chip">
            <Activity size={13} />
            {quakeList.length} {currentLang === 'hi' ? 'भूकंप रिकॉर्ड' : 'Seismic Records'}
          </span>
          {location && (
            <span className="alerts-chip">
              <MapPin size={13} color="#ef4444" />
              {location.city || location.name || 'Current Region'}
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="page-error" style={{ marginBottom: '20px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} color="var(--color-warning, #f59e0b)" />
            {error}
          </span>
          <button onClick={loadData}>{currentLang === 'hi' ? 'पुनः प्रयास करें' : 'Retry'}</button>
        </div>
      )}

      {/* IMD District Alert (if active) */}
      {districtAlert && (
        <section
          className={`district-alert-detail district-alert-detail--${districtAlert.severity || 'green'}`}
          style={{
            background: 'var(--surface-card, rgba(255, 255, 255, 0.04))',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            padding: '20px',
            marginBottom: '24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px'
          }}
        >
          <div>
            <span
              style={{
                fontSize: '11px',
                fontWeight: '700',
                letterSpacing: '1px',
                color: '#f59e0b',
                display: 'block',
                marginBottom: '4px'
              }}
            >
              IMD DISTRICT WARNING
            </span>
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 6px' }}>{districtAlert.name}</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>{districtAlert.summary}</p>
          </div>
          <span
            className="severity-tag"
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontWeight: '700',
              textTransform: 'uppercase',
              fontSize: '12px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444'
            }}
          >
            {districtAlert.severity || 'No warning'}
          </span>
        </section>
      )}

      {/* GDACS Alerts Feed */}
      <section className="alerts-section">
        <div className="alerts-section__header">
          <h3 className="alerts-section__title">
            <Radio size={18} color="#f59e0b" />
            <span>GDACS Disaster Feed</span>
          </h3>
          <span className="alerts-badge">
            {showAllAlerts
              ? (currentLang === 'hi' ? `सभी ${alertList.length} प्रदर्शित` : `Showing all ${alertList.length}`)
              : (currentLang === 'hi' ? `${Math.min(ALERT_LIMIT, alertList.length)} / ${alertList.length} प्रदर्शित` : `Showing ${Math.min(ALERT_LIMIT, alertList.length)} of ${alertList.length}`)}
          </span>
        </div>

        {alertList.length === 0 ? (
          <div className="alerts-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span className="alerts-empty__icon" style={{ display: 'inline-block', marginBottom: '8px' }}>
              <CheckCircle2 size={32} color="#10b981" />
            </span>
            <div className="alerts-empty__text" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {currentLang === 'hi'
                ? 'GDACS फ़ीड में वर्तमान में कोई सक्रिय आपदा चेतावनी नहीं है।'
                : 'No active disaster alerts in the GDACS feed.'}
            </div>
          </div>
        ) : (
          <>
            <div className="alerts-list">
              {displayedAlerts.map((a, i) => {
                const badge = getAlertBadgeColor(a);
                return (
                  <div key={i} className="alert-list-item">
                    <div className={`alert-list-item__indicator ${getAlertSeverityClass(a)}`} />
                    <div className="alert-list-item__content">
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                        <span className="alert-list-item__title">{a.title || 'Unnamed Alert'}</span>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: '700',
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: badge.bg,
                            color: badge.color,
                            border: `1px solid ${badge.border}`,
                            whiteSpace: 'nowrap',
                            textTransform: 'uppercase'
                          }}
                        >
                          {a.category || 'Disaster'}
                        </span>
                      </div>
                      <span className="alert-list-item__desc">{a.description || 'No detailed description available.'}</span>
                      <span className="alert-list-item__meta">
                        <span>Source: GDACS</span>
                        <span>•</span>
                        <span>{(a.updatedAt || a.pubDate) ? `Updated: ${new Date(a.updatedAt || a.pubDate).toLocaleString()}` : 'Live'}</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* View Total Alerts Button */}
            {alertList.length > ALERT_LIMIT && (
              <button
                type="button"
                className="alerts-view-all-btn"
                onClick={() => setShowAllAlerts((prev) => !prev)}
                aria-expanded={showAllAlerts}
              >
                {showAllAlerts ? (
                  <>
                    <ChevronUp size={16} />
                    <span>
                      {currentLang === 'hi'
                        ? `कम दिखाएं (शीर्ष ${ALERT_LIMIT} चेतावनियां)`
                        : `Show Less (Top ${ALERT_LIMIT} Alerts)`}
                    </span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    <span>
                      {currentLang === 'hi'
                        ? `कुल चेतावनियां देखें (सभी ${alertList.length} अलर्ट्स)`
                        : `View Total Alerts (${alertList.length} Total Alerts)`}
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </section>

      {/* Earthquakes Activity Feed */}
      <section className="alerts-section">
        <div className="alerts-section__header">
          <h3 className="alerts-section__title">
            <Activity size={18} color="#06b6d4" />
            <span>{currentLang === 'hi' ? 'भूकंपीय गतिविधि (Seismic Activity)' : 'Seismic Activity — India Region'}</span>
          </h3>
          <span className="alerts-badge" style={{ background: 'rgba(6, 182, 212, 0.12)', color: '#06b6d4', borderColor: 'rgba(6, 182, 212, 0.25)' }}>
            {showAllQuakes
              ? (currentLang === 'hi' ? `सभी ${quakeList.length} प्रदर्शित` : `Showing all ${quakeList.length}`)
              : (currentLang === 'hi' ? `${Math.min(QUAKE_LIMIT, quakeList.length)} / ${quakeList.length} प्रदर्शित` : `Showing ${Math.min(QUAKE_LIMIT, quakeList.length)} of ${quakeList.length}`)}
          </span>
        </div>

        {quakeList.length === 0 ? (
          <div className="alerts-empty" style={{ padding: '32px 16px', textAlign: 'center' }}>
            <span className="alerts-empty__icon" style={{ display: 'inline-block', marginBottom: '8px' }}>
              <ShieldCheck size={32} color="#10b981" />
            </span>
            <div className="alerts-empty__text" style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {currentLang === 'hi'
                ? 'हाल ही में कोई महत्वपूर्ण भूकंपीय गतिविधि दर्ज नहीं की गई है।'
                : 'No significant seismic activity reported recently.'}
            </div>
          </div>
        ) : (
          <>
            <div className="quakes-list">
              {displayedQuakes.map((q, i) => (
                <div key={q.id || i} className={`quake-list-item quake-list-item--${q.severity || 'minor'}`}>
                  <span className={`quake-mag quake-mag--${q.severity || 'minor'}`}>
                    {typeof q.magnitude === 'number' ? q.magnitude.toFixed(1) : q.magnitude || '—'}
                  </span>
                  <div className="quake-list-item__info">
                    <span className="quake-list-item__place">{q.place || 'Unknown Location'}</span>
                    <span className="quake-list-item__meta">
                      Depth: {q.depth != null ? `${Number(q.depth).toFixed(1)} km` : '—'} · {q.time || 'Recent'}
                    </span>
                  </div>
                  <span className={`severity-tag severity-tag--${q.severity || 'minor'}`}>
                    {q.severity || 'info'}
                  </span>
                </div>
              ))}
            </div>

            {/* View Total Earthquakes Button */}
            {quakeList.length > QUAKE_LIMIT && (
              <button
                type="button"
                className="alerts-view-all-btn"
                onClick={() => setShowAllQuakes((prev) => !prev)}
                aria-expanded={showAllQuakes}
              >
                {showAllQuakes ? (
                  <>
                    <ChevronUp size={16} />
                    <span>
                      {currentLang === 'hi'
                        ? `कम दिखाएं (शीर्ष ${QUAKE_LIMIT} भूकंप)`
                        : `Show Less (Top ${QUAKE_LIMIT} Earthquakes)`}
                    </span>
                  </>
                ) : (
                  <>
                    <ChevronDown size={16} />
                    <span>
                      {currentLang === 'hi'
                        ? `कुल भूकंप देखें (सभी ${quakeList.length} रिकॉर्ड)`
                        : `View Total Earthquakes (${quakeList.length} Recorded)`}
                    </span>
                  </>
                )}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
