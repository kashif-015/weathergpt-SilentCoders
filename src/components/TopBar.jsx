import { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

export default function TopBar({
  activePage = 'chat',
  onNavigate,
  onNavigateForecast,
  weather,
  location,
  userProfile,
  onSearch,
  onOpenAuth,
  onToggleMenu
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if (e.key === 'Escape') setSearchOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    if (searchValue.trim() && onSearch) {
      onSearch(searchValue.trim());
      setSearchValue('');
      setSearchOpen(false);
    }
  };

  return (
    <header className="topbar" role="banner">
      <div className="topbar__left">
        <button className="topbar__menu-btn" onClick={onToggleMenu} aria-label="Toggle sidebar menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 12h18M3 6h18M3 18h18"/>
          </svg>
        </button>
      </div>

      <div className="topbar__center">
        <div className="topbar__tabs" role="tablist" aria-label="Primary navigation">
          <button
            role="tab"
            aria-selected={activePage === 'chat'}
            className={`topbar__tab ${activePage === 'chat' ? 'topbar__tab--active' : ''}`}
            onClick={() => onNavigate && onNavigate('chat')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <span>Chat</span>
          </button>
          <button
            role="tab"
            aria-selected={activePage === 'home'}
            className={`topbar__tab ${activePage === 'home' ? 'topbar__tab--active' : ''}`}
            onClick={() => onNavigate && onNavigate('home')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
              <polyline points="9 22 9 12 15 12 15 22"/>
            </svg>
            <span>Home</span>
          </button>
        </div>
      </div>

      <div className="topbar__right">
        {weather && location ? (
          <div
            className="topbar__weather-ctx"
            onClick={onNavigateForecast}
            role="button"
            tabIndex={0}
            title="Click to view detailed forecast"
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onNavigateForecast?.(); } }}
          >
            <div className="topbar__weather-loc">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                <circle cx="12" cy="10" r="3"/>
              </svg>
              <span>{location.city || location.name || 'Current City'}</span>
            </div>
            <div className="topbar__weather-sep" />
            <div className="topbar__weather-temp">
              <span>{Math.round(weather.temp ?? weather.temperature ?? 0)}°C</span>
              {weather.description && (
                <span className="topbar__weather-desc">· {weather.description}</span>
              )}
            </div>
          </div>
        ) : (
          <div className="topbar__weather-skeleton">
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <MapPin size={13} color="#ef4444" /> Locating...
            </span>
          </div>
        )}

      </div>

      {/* Search Modal */}
      {searchOpen && (
        <div className="search-modal-overlay" onClick={() => setSearchOpen(false)}>
          <div className="search-modal" onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSearchSubmit} className="search-modal__form">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <path d="m21 21-4.3-4.3"/>
              </svg>
              <input
                ref={searchRef}
                type="text"
                className="search-modal__input"
                placeholder="Search city, district, or ask WeatherGPT anything..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                autoFocus
              />
              <kbd onClick={() => setSearchOpen(false)}>Esc</kbd>
            </form>
          </div>
        </div>
      )}
    </header>
  );
}
