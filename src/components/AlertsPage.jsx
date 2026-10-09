import { useState, useEffect } from 'react';
import { getRecentEarthquakes, getIndiaEarthquakes } from '../services/weatherService.js';
import { getGdacsAlerts } from '../services/apiClients.js';
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

export default function AlertsPage({ location, districtAlert, onBackToChat }) {
  const [alerts, setAlerts] = useState(null);
  const [quakes, setQuakes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [gdacs, eq] = await Promise.all([
          getGdacsAlerts(),
          getIndiaEarthquakes().catch(() => []),
        ]);
        setAlerts(gdacs?.alerts || []);
        setQuakes(Array.isArray(eq) ? eq.slice(0, 10) : []);
      } catch (e) {
        setError('Failed to fetch alert data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="page-content">
        {onBackToChat && (
          <button className="forecast-page__back" onClick={onBackToChat} style={{ marginBottom: 'var(--sp-3)' }}>
            ← Back to Chat
          </button>
        )}
        <div className="page-content__header">
          <h2>Disaster Alerts</h2>
          <p>Real-time alerts from GDACS, USGS and IMD</p>
        </div>
        <div className="skeleton-grid">
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton-card">
              <div className="skeleton skeleton--text" style={{ width: '60%' }} />
              <div className="skeleton skeleton--text" style={{ width: '90%', marginTop: '8px' }} />
              <div className="skeleton skeleton--text" style={{ width: '40%', marginTop: '8px' }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {onBackToChat && (
        <button className="forecast-page__back" onClick={onBackToChat} style={{ marginBottom: 'var(--sp-3)' }}>
          ← Back to Chat
        </button>
      )}
      <div className="page-content__header">
        <h2>Disaster Alerts</h2>
        <p>Real-time alerts from GDACS, USGS and IMD</p>
      </div>

      {error && (
        <div className="page-error">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} color="var(--color-warning, #f59e0b)" />
            {error}
          </span>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      )}

      {districtAlert && (
        <section className={`district-alert-detail district-alert-detail--${districtAlert.severity || 'green'}`}>
          <div><span className="district-alert-detail__eyebrow">IMD DISTRICT WARNING</span><h3>{districtAlert.name}</h3><p>{districtAlert.summary}</p></div>
          <span className="district-alert-detail__severity">{districtAlert.severity || 'No warning'}</span>
        </section>
      )}

      {/* GDACS Alerts */}
      <section className="alerts-section">
        <h3 className="alerts-section__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></svg>
          GDACS Disaster Feed
        </h3>
        {alerts.length === 0 ? (
          <div className="alerts-empty">
            <span className="alerts-empty__icon">
              <CheckCircle2 size={24} color="#10b981" />
            </span>
            <span className="alerts-empty__text">No active disaster alerts in the GDACS feed.</span>
          </div>
        ) : (
          <div className="alerts-list">
            {alerts.map((a, i) => (
              <div key={i} className="alert-list-item">
                <div className="alert-list-item__indicator" />
                <div className="alert-list-item__content">
                  <span className="alert-list-item__title">{a.title || 'Unnamed Alert'}</span>
                  <span className="alert-list-item__desc">{a.description?.slice(0, 150)}</span>
                  <span className="alert-list-item__meta">
                    Source: GDACS · {a.category || 'General'}
                    {(a.updatedAt || a.pubDate) && ` · Updated ${new Date(a.updatedAt || a.pubDate).toLocaleString()}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Earthquakes */}
      <section className="alerts-section">
        <h3 className="alerts-section__title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m2 12 2-2 3 3 4-4 3 3 4-4 4 4"/></svg>
          Seismic Activity — India Region
        </h3>
        {quakes.length === 0 ? (
          <div className="alerts-empty">
            <span className="alerts-empty__icon">
              <ShieldCheck size={24} color="#10b981" />
            </span>
            <span className="alerts-empty__text">No significant seismic activity reported recently.</span>
          </div>
        ) : (
          <div className="quakes-list">
            {quakes.map((q, i) => (
              <div key={q.id || i} className={`quake-list-item quake-list-item--${q.severity}`}>
                <span className={`quake-mag quake-mag--${q.severity}`}>
                  {q.magnitude.toFixed(1)}
                </span>
                <div className="quake-list-item__info">
                  <span className="quake-list-item__place">{q.place}</span>
                  <span className="quake-list-item__meta">
                    Depth: {q.depth?.toFixed(1) || '—'} km · {q.time}
                  </span>
                </div>
                <span className={`severity-tag severity-tag--${q.severity}`}>
                  {q.severity}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
