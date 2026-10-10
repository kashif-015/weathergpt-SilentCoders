import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getCurrentWeather, getForecast, getUserLocation, reverseGeocode, getStoredLocation, onLocationPermissionChange, geocodeCity } from './services/weatherService.js';
import { processQuery } from './services/chatEngine.js';
import { getCurrentUserProfile, signOutUser, observeAuthState, updateUserProfile } from './services/firebaseClient.js';
import { getTranslation } from './services/translations.js';
import appMetadata from '../package.json';
import { speakSarvamText } from './services/voiceService.js';
import {
  loadAllConversations, createConversation, saveConversation, deleteConversation, groupByDate, setHistoryUser,
  deleteConversationFromSupabase, hydrateConversationsFromSupabase, syncAllConversationsToSupabase,
  syncConversationToSupabase,
} from './services/chatHistory.js';
import AuthModal from './components/AuthModal.jsx';
import ProfilePage from './components/ProfilePage.jsx';
import TopBar from './components/TopBar.jsx';
import HomePage from './components/HomePage.jsx';
import RightPanel from './components/RightPanel.jsx';
import AlertsPage from './components/AlertsPage.jsx';
import ForecastPage from './components/ForecastPage.jsx';
import WeatherMap from './components/WeatherMap.jsx';
import ClimateInsights from './components/ClimateInsights.jsx';
import AgricultureAdvisory from './components/AgricultureAdvisory.jsx';
import WeatherIcon from './components/WeatherIcon.jsx';
import weatherGPTLogo from './assets/weatherGPT_logo.png';
import {
  ShieldAlert,
  AlertTriangle,
  ShieldCheck,
  Globe,
  Wheat,
  CloudSunRain,
  Calendar,
  CloudRain,
  Activity,
  Sparkles,
  Copy,
  Check,
  Pencil,
  RotateCcw,
  ThumbsDown,
  Share2,
  Sun,
  Moon,
  FileText,
  Database,
  Info
} from 'lucide-react';

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

// ==================== NAV CONFIG ====================
const PRIMARY_NAV_ITEMS = [
  { id: 'forecast', label: 'Forecast', icon: 'forecast' },
  { id: 'maps', label: 'Weather Map', icon: 'maps' },
  { id: 'alerts', label: 'Disaster Alerts', icon: 'alerts' },
  { id: 'agriculture', label: 'Agriculture', icon: 'agriculture' },
  { id: 'climate', label: 'Climate Insights', icon: 'climate' },
];

const MORE_NAV_ITEMS = [
  { id: 'data', label: 'Data & APIs', icon: 'data' },
  { id: 'settings', label: 'Settings', icon: 'settings' },
];

const NAV_COLORS = {
  home: '#38bdf8',
  chat: '#8b5cf6',
  forecast: '#f59e0b',
  maps: '#10b981',
  alerts: '#ef4444',
  agriculture: '#84cc16',
  climate: '#06b6d4',
  data: '#6366f1',
  settings: '#ec4899',
  more: '#94a3b8',
};

function NavIcon({ name }) {
  const color = NAV_COLORS[name] || 'currentColor';
  const icons = {
    home: <><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>,
    chat: <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
    forecast: <><path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></>,
    maps: <><polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"/><line x1="9" y1="3" x2="9" y2="18"/><line x1="15" y1="6" x2="15" y2="21"/></>,
    alerts: <><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/></>,
    agriculture: <><path d="M12 22c5.5-2 8-7 8-12H4c0 5 2.5 10 8 12z"/><path d="M12 2v10"/><path d="m8 6 4-2 4 2"/></>,
    climate: <><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></>,
    multilingual: <><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></>,
    data: <><path d="M18 20V10M12 20V4M6 20v-6"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  };
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
    >
      {icons[name] || icons.home}
    </svg>
  );
}

function SidebarSearch({ conversations, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const searchInputRef = useRef(null);
  const recentChats = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  return (
    <div className="sidebar-search">
      <div className="sidebar-search__topbar">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4-4" />
        </svg>
        <input
          ref={searchInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search..."
          aria-label="Search recent chats"
        />
        <button onClick={onClose} aria-label="Close search">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </button>
      </div>
      <div className="sidebar-search__heading">Recent chats</div>
      <div className="sidebar-search__list">
        {recentChats.length > 0 ? recentChats.map((conversation) => (
          <button
            className="sidebar-search__item"
            key={conversation.id}
            onClick={() => { onSelect(conversation.id); onClose(); }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
            <span>{conversation.title}</span>
          </button>
        )) : (
          <div className="sidebar-search__empty">No recent chats found</div>
        )}
      </div>
    </div>
  );
}

// ==================== SIDEBAR RAIL (ChatGPT-style mini bar) ====================
function SidebarRail({
  onToggleSidebar, onNew, onNavigate, activePage,
  onOpenSearch, onOpenRecent, onOpenSettings,
  userProfile, onOpenAuth, onOpenProfile
}) {
  const getInitials = () => {
    if (!userProfile) return null;
    const name = userProfile.name?.trim();
    if (name) {
      const parts = name.split(/\s+/);
      if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
      return name.slice(0, 2).toUpperCase();
    }
    if (userProfile.email) return userProfile.email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const initials = getInitials();

  return (
    <aside className="sidebar-rail" aria-label="Sidebar navigation rail">
      {/* Top App Icon: On hover, turns into Sidebar Button */}
      <button
        className="sidebar-rail__btn sidebar-rail__btn--toggle"
        onClick={() => onToggleSidebar(true)}
        data-tooltip="Open sidebar"
        aria-label="Open sidebar"
      >
        <div className="sidebar-rail__logo-icon">
          <img src={weatherGPTLogo} alt="WeatherGPT" className="sidebar-rail__logo-img" />
        </div>
        <div className="sidebar-rail__panel-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="3" />
            <path d="M9 3v18" />
          </svg>
        </div>
      </button>

      {/* Nav Buttons */}
      <div className="sidebar-rail__nav">
        {/* New Chat */}
        <button
          className="sidebar-rail__btn"
          onClick={() => { onNew(); if (activePage !== 'chat') onNavigate('chat'); }}
          data-tooltip="New chat"
          aria-label="New chat"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>

        {/* Search */}
        <button
          className="sidebar-rail__btn"
          onClick={onOpenSearch}
          data-tooltip="Search"
          aria-label="Search chats"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
        </button>

        {/* Recent */}
        <button
          className="sidebar-rail__btn"
          onClick={onOpenRecent}
          data-tooltip="Recent chats"
          aria-label="Recent chats"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>

        {/* Setting */}
        <button
          className="sidebar-rail__btn"
          onClick={onOpenSettings}
          data-tooltip="Settings"
          aria-label="Settings"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>
      </div>

      {/* Bottom User Profile */}
      <div className="sidebar-rail__bottom">
        <button
          className="sidebar-rail__avatar-btn"
          onClick={userProfile ? onOpenProfile : onOpenAuth}
          data-tooltip={userProfile ? (userProfile.name || userProfile.email) : 'Sign in'}
          aria-label="User profile"
        >
          {initials ? (
            <div className="sidebar-rail__avatar">
              {initials}
            </div>
          ) : (
            <div className="sidebar-rail__avatar sidebar-rail__avatar--guest">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}

// ==================== SIDEBAR ====================
function Sidebar({
  conversations, activeId, onSelect, onNew, onDelete,
  userProfile, onOpenAuth, onOpenProfile, onLogout,
  onOpenSettings, currentLang, onToggleLang,
  isOpen, onClose, activePage, onNavigate,
  initialSearchOpen = false, onResetSearch
}) {
  const t = (key) => getTranslation(key, currentLang);
  const groups = groupByDate(conversations, currentLang);
  const firstLetter = (userProfile?.name || 'U').charAt(0).toUpperCase();
  const [showMoreFeatures, setShowMoreFeatures] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    if (initialSearchOpen) {
      setSearchOpen(true);
      onResetSearch?.();
    }
  }, [initialSearchOpen, onResetSearch]);

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}
      <aside className={`sidebar ${isOpen ? 'sidebar--open' : 'sidebar--closed'}`} aria-label="Navigation sidebar">
        {searchOpen ? (
          <SidebarSearch conversations={conversations} onSelect={onSelect} onClose={() => setSearchOpen(false)} />
        ) : <>
        {/* Brand */}
        <div className="sidebar__brand">
          <div className="sidebar__brand-icon">
            <img src={weatherGPTLogo} alt="WeatherGPT" className="sidebar__brand-img" />
          </div>
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-name">WeatherGPT</span>
            <span className="sidebar__brand-tagline">AI Weather Intelligence</span>
          </div>
          {activePage === 'chat' && (
            <button className="sidebar__search-btn" onClick={() => setSearchOpen(true)} aria-label="Search chats" title="Search chats">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>
            </button>
          )}
          <button className="sidebar__close-btn" onClick={onClose} aria-label="Close sidebar" title="Collapse sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="3" rx="3" />
              <path d="M9 3v18" />
            </svg>
          </button>
        </div>

        {/* New Chat Button on top */}
        <div className="sidebar__new-chat-wrap">
          <button
            className="sidebar__new-chat-full"
            onClick={() => { onNew(); if (activePage !== 'chat') onNavigate('chat'); onClose(); }}
            title="New chat"
            aria-label="New chat"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14"/>
            </svg>
            <span>New Chat</span>
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="sidebar__nav" aria-label="Main navigation">
          {PRIMARY_NAV_ITEMS
            .filter(item => item.id !== 'agriculture' || userProfile?.occupation === 'Farmer')
            .map(item => (
            <button
              key={item.id}
              className={`sidebar__nav-item ${activePage === item.id ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => { onNavigate(item.id); onClose(); }}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
          {activePage === 'chat' && !showMoreFeatures && (
            <button
              className="sidebar__nav-item"
              onClick={() => setShowMoreFeatures(true)}
              aria-expanded={false}
            >
              <NavIcon name="more" />
              <span>More</span>
              <svg className="sidebar__more-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
            </button>
          )}
          {(activePage !== 'chat' || showMoreFeatures) && MORE_NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`sidebar__nav-item sidebar__nav-item--more ${activePage === item.id ? 'sidebar__nav-item--active' : ''}`}
              onClick={() => { onNavigate(item.id); onClose(); }}
              aria-current={activePage === item.id ? 'page' : undefined}
            >
              <NavIcon name={item.icon} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Chat history belongs only to the chat workspace. */}
        {activePage === 'chat' && <div className="sidebar__history-section">
          <div className="sidebar__history-header">
            <span>Recent Chats</span>
            <button
              className="sidebar__new-chat-btn"
              onClick={() => { onNew(); if (activePage !== 'chat') onNavigate('chat'); }}
              title="New chat"
              aria-label="New chat"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
            </button>
          </div>
          <div className="sidebar__history-list">
            {groups.length === 0 ? (
              <div className="sidebar__empty">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Start your first weather conversation</span>
              </div>
            ) : (
              groups.map((group, gi) => (
                <div key={gi} className="sidebar__group">
                  <div className="sidebar__group-label">{group.label}</div>
                  {group.items.map(conv => (
                    <div
                      key={conv.id}
                      className={`sidebar__item ${conv.id === activeId ? 'sidebar__item--active' : ''}`}
                      onClick={() => { onSelect(conv.id); if (activePage !== 'chat') onNavigate('chat'); onClose(); }}
                    >
                      <svg className="sidebar__item-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      <span className="sidebar__item-title">{conv.title}</span>
                      <button
                        className="sidebar__item-delete"
                        onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                        title="Delete conversation"
                        aria-label="Delete conversation"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>}

        {/* Footer */}
        <div className="sidebar__footer">
          <div className="sidebar__footer-cta">
            {!userProfile ? (
              <>
                <p className="sidebar__footer-title">Personalized Weather</p>
                <p className="sidebar__footer-desc">
                  Sign in to save chat history, configure custom alerts, and sync across devices.
                </p>
                <button className="sidebar__signin-btn" onClick={onOpenAuth}>
                  Sign In / Register
                </button>
              </>
            ) : (
              <button className="sidebar__user" onClick={onOpenProfile} title="View account profile">
                <div className="sidebar__user-avatar">{firstLetter}</div>
                <div className="sidebar__user-info">
                  <span className="sidebar__user-name">{userProfile.name}</span>
                  <span className="sidebar__user-meta">{userProfile.email || 'Free Member'}</span>
                </div>
                <svg className="sidebar__user-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
              </button>
            )}
          </div>
          <div className="sidebar__footer-bottom">
            <span className="sidebar__footer-india">Built for a safer, greener India</span>
          </div>
        </div>
        </>}
      </aside>
    </>
  );
}

// ==================== MESSAGE ====================
function Message({ message, onEditMessage, onRetryMessage }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(message.text);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setEditText(message.text);
  }, [message.text]);

  const handleCopy = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSaveEdit = (e) => {
    if (e) e.preventDefault();
    if (editText.trim() && editText.trim() !== message.text) {
      if (onEditMessage) {
        onEditMessage(message.id, editText.trim());
      }
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(message.text);
    setIsEditing(false);
  };

  const renderText = (text) => {
    if (!text) return null;
    return text.split('\n').map((line, i) => (
      <span key={i}>
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) => {
          const isBold = part.startsWith('**') && part.endsWith('**');
          const cleanPart = isBold ? part.slice(2, -2) : part;

          // Replace known emojis with WeatherIcon components
          const segments = cleanPart.split(/([☀️🌤️⛅☁️🌫️🌦️🌧️🌨️❄️⛈️🌡️💧💨🌅🌇🌙⚠️🔴🟠🟢🟡🔵✅🥵🧣🍃🚨📅🌾🌍⚡🧠🛡️👁️🧭📊])/gu);
          const rendered = segments.map((seg, k) => {
            if (/^[☀️🌤️⛅☁️🌫️🌦️🌧️🌨️❄️⛈️🌡️💧💨🌅🌇🌙⚠️🔴🟠🟢🟡🔵✅🥵🧣🍃🚨📅🌾🌍⚡🧠🛡️👁️🧭📊]$/u.test(seg)) {
              return <WeatherIcon key={k} icon={seg} size={15} style={{ verticalAlign: 'middle', margin: '0 2px' }} />;
            }
            return seg;
          });

          return isBold ? <strong key={j}>{rendered}</strong> : <React.Fragment key={j}>{rendered}</React.Fragment>;
        })}
        {i < text.split('\n').length - 1 && <br />}
      </span>
    ));
  };

  const isUser = message.role === 'user';
  const [shared, setShared] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const handleShare = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(message.text);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  if (isUser) {
    return (
      <div className="msg-row msg-row--user">
        <div className="msg-row__wrapper">
          {isEditing ? (
            <form className="msg-row__edit-box" onSubmit={handleSaveEdit}>
              <textarea
                className="msg-row__edit-textarea"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                autoFocus
                rows={Math.min(6, Math.max(2, editText.split('\n').length))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSaveEdit(e);
                  }
                  if (e.key === 'Escape') {
                    handleCancelEdit();
                  }
                }}
              />
              <div className="msg-row__edit-actions">
                <button type="button" className="msg-edit-btn msg-edit-btn--cancel" onClick={handleCancelEdit}>
                  Cancel
                </button>
                <button type="submit" className="msg-edit-btn msg-edit-btn--send" disabled={!editText.trim()}>
                  Send
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="msg-user-pill">
                <span className="msg-user-pill__text">{renderText(message.text)}</span>
              </div>
              <div className="msg-row__actions msg-row__actions--user">
                <button
                  type="button"
                  className="msg-action-btn"
                  onClick={handleCopy}
                  title={copied ? "Copied!" : "Copy"}
                  aria-label="Copy message"
                >
                  {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  {copied && <span className="msg-action-btn__tooltip">Copied!</span>}
                </button>
                <button
                  type="button"
                  className="msg-action-btn"
                  onClick={handleShare}
                  title={shared ? "Copied link!" : "Share"}
                  aria-label="Share message"
                >
                  <Share2 size={14} />
                </button>
                <button
                  type="button"
                  className="msg-action-btn"
                  onClick={() => { setEditText(message.text); setIsEditing(true); }}
                  title="Edit"
                  aria-label="Edit message"
                >
                  <Pencil size={14} />
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="msg-row msg-row--bot">
      <div className="msg-row__wrapper">
        <div className="msg-bot-text">{renderText(message.text)}</div>

        {message.type === 'forecast' && message.data && (
          <div className="forecast-card" style={{ marginTop: '12px', width: '100%' }}>
            <div className="forecast-card__title">IMD / NWP 7-DAY FORECAST</div>
            <div className="forecast-days">
              {message.data.map((day, i) => (
                <div className="forecast-day" key={i}>
                  <span className="forecast-day__name">{day.dayName}</span>
                  <span className="forecast-day__icon">
                    <WeatherIcon icon={day.icon} size={20} />
                  </span>
                  <span className="forecast-day__temp">{day.maxTemp}°</span>
                  <span className="forecast-day__low">{day.minTemp}°</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {message.type === 'earthquake' && message.data && (
          <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
            {message.data.map((q, i) => (
              <div className="quake-card" key={i}>
                <div className="quake-card__header">
                  <span className={`quake-card__mag quake-card__mag--${q.severity}`}>{q.magnitude.toFixed(1)}</span>
                  <div className="quake-card__info">
                    <div className="quake-card__place">{q.place}</div>
                    <div className="quake-card__time">{q.time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {message.type === 'alert' && (
          <div className={`alert-card alert-card--${message.severity || 'green'}`} style={{ marginTop: '12px', width: '100%' }}>
            <div className="alert-card__header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {message.severity === 'red' ? (
                <ShieldAlert size={16} color="#ef4444" />
              ) : message.severity === 'orange' ? (
                <AlertTriangle size={16} color="#f59e0b" />
              ) : (
                <ShieldCheck size={16} color="#10b981" />
              )}
              <span>{message.severity === 'green' ? 'All Clear' : 'Active Warning'}</span>
            </div>
          </div>
        )}

        {message.source && (
          <div className="msg-bot-source">
            Generated using: {Array.isArray(message.source) ? message.source.join(', ') : message.source}
          </div>
        )}

        <div className="msg-row__actions msg-row__actions--bot">
          <button
            type="button"
            className="msg-action-btn"
            onClick={handleCopy}
            title={copied ? "Copied!" : "Copy"}
            aria-label="Copy response"
          >
            {copied ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
            {copied && <span className="msg-action-btn__tooltip">Copied!</span>}
          </button>
          <button
            type="button"
            className={`msg-action-btn ${feedback === 'down' ? 'msg-action-btn--active' : ''}`}
            onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
            title="Bad response"
            aria-label="Bad response"
          >
            <ThumbsDown size={14} />
          </button>
          <button
            type="button"
            className="msg-action-btn"
            onClick={handleShare}
            title="Share"
            aria-label="Share response"
          >
            <Share2 size={14} />
          </button>
          {onRetryMessage && (
            <button
              type="button"
              className="msg-action-btn"
              onClick={() => onRetryMessage(message.id)}
              title="Regenerate response"
              aria-label="Regenerate response"
            >
              <RotateCcw size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="msg-row msg-row--bot">
      <div className="msg-row__wrapper">
        <div className="typing-indicator"><span /><span /><span /></div>
      </div>
    </div>
  );
}

const SAMPLE_QUESTION_CONFIG = [
  { icon: CloudSunRain, color: '#38bdf8', bg: 'rgba(56, 189, 248, 0.15)' },
  { icon: Calendar, color: '#818cf8', bg: 'rgba(129, 140, 248, 0.15)' },
  { icon: CloudRain, color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)' },
  { icon: Activity, color: '#ec4899', bg: 'rgba(236, 72, 153, 0.15)' },
  { icon: Wheat, color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)' },
  { icon: AlertTriangle, color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' }
];

function ChatEmptyState({ onQuestionClick, currentLang }) {
  const t = (key) => getTranslation(key, currentLang);
  const sampleQuestions = t('sampleQuestions');
  return (
    <div className="chat-empty-state">
      <div className="chat-empty-state__icon">
        <img src={weatherGPTLogo} alt="WeatherGPT" className="chat-empty-state__logo-img" />
      </div>
      <h2 className="chat-empty-state__title">{t('heroTitle')}</h2>
      <p className="chat-empty-state__subtitle">{t('heroSubtitle')}</p>
      <div className="chat-empty-state__questions">
        {sampleQuestions.map((q, i) => {
          const cfg = SAMPLE_QUESTION_CONFIG[i % SAMPLE_QUESTION_CONFIG.length];
          const QuestionIcon = cfg.icon;
          return (
            <button key={i} className="chat-empty-state__question" onClick={() => onQuestionClick(q.text)}>
              <span className="chat-empty-state__question-icon" style={{ background: cfg.bg, padding: '5px', borderRadius: '8px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <QuestionIcon size={16} color={cfg.color} />
              </span>
              {q.text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function VoiceOverlay({ isListening, transcript, onClose, currentLang }) {
  const t = (key) => getTranslation(key, currentLang);
  return (
    <div className="voice-overlay">
      <button className="voice-overlay__close" onClick={onClose} aria-label="Close voice input">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
      </button>
      <div className="voice-overlay__wave">
        {[...Array(8)].map((_, i) => <div key={i} className="voice-overlay__bar" />)}
      </div>
      <div className="voice-overlay__status">
        {isListening ? t('listeningVoice') : t('processingVoice')}
      </div>
      <div className="voice-overlay__transcript">{transcript || t('voiceHint')}</div>
    </div>
  );
}

function SettingsPanel({ onClose, theme, setTheme, currentLang, setAppLanguage }) {
  const [documentView, setDocumentView] = useState('');
  const isHindi = currentLang === 'hi';
  const sourceCredits = [
    ['IMD · NCMRWF', isHindi ? 'भारतीय मौसम विज्ञान संदर्भ; उपलब्धता स्थान और फीड पर निर्भर करती है।' : 'Indian weather institution references; feed availability depends on location and coverage.'],
    ['Open-Meteo', isHindi ? 'वर्तमान मौसम और पूर्वानुमान के लिए वैश्विक बिंदु डेटा।' : 'Global point weather and forecast data, including fallback coverage.'],
    ['Bhashini', isHindi ? 'कॉन्फ़िगर होने पर भाषा और वॉइस सुविधाएँ।' : 'Language and voice features when configured; browser speech may be used as fallback.'],
    ['NASA POWER', isHindi ? 'कृषि-मौसम और सौर डेटा।' : 'Agrometeorology and solar data.'],
    ['GDACS · USGS/NCS', isHindi ? 'आपदा और भूकंपीय जानकारी।' : 'Disaster and seismic information feeds.'],
    ['Copernicus ERA5', isHindi ? 'ऐतिहासिक जलवायु रुझान।' : 'Historical climate trend data.'],
  ];
  const policyContent = documentView === 'privacy'
    ? {
        title: isHindi ? 'गोपनीयता' : 'Privacy policy',
        paragraphs: isHindi ? [
          'WeatherGPT मौसम सेवाएँ देने के लिए आपके चुने हुए स्थान या डिवाइस के अनुमानित स्थान का उपयोग करता है।',
          'आपके खाते और चैट इतिहास का प्रबंधन Firebase और Supabase सेवाओं के माध्यम से हो सकता है। मौसम प्रश्नों को उत्तर तैयार करने के लिए कॉन्फ़िगर किए गए AI प्रदाताओं के साथ साझा किया जा सकता है।',
          'इस ऐप में खाता या डेटा हटाने के अनुरोध के लिए ऐप प्रशासक से संपर्क करें।'
        ] : [
          'WeatherGPT uses a location you select or an approximate device location to provide local weather. Location is sent to the weather providers needed to answer your request.',
          'Account data and chat history may be handled by Firebase and Supabase. Weather questions may be sent to configured AI providers to generate responses.',
          'Contact the app operator to request account or data deletion. Avoid sharing sensitive personal information in chat.'
        ]
      }
    : {
        title: isHindi ? 'नियम और शर्तें' : 'Terms of use',
        paragraphs: isHindi ? [
          'WeatherGPT मौसम संबंधी जानकारी और सामान्य मार्गदर्शन देता है। डेटा में देरी या त्रुटि हो सकती है।',
          'गंभीर मौसम या आपदा की स्थिति में IMD, स्थानीय प्रशासन और आपातकालीन सेवाओं के आधिकारिक निर्देशों का पालन करें। ऐप की जानकारी को सुरक्षा या कृषि के महत्वपूर्ण निर्णयों का एकमात्र आधार न बनाएं।',
          'इस ऐप का उपयोग करके आप समझते हैं कि सेवाएँ उपलब्धता के अनुसार प्रदान की जाती हैं।'
        ] : [
          'WeatherGPT provides weather information and general guidance. Data can be delayed, incomplete, or inaccurate.',
          'For severe weather or emergencies, follow official IMD, local authority, and emergency service instructions. Do not rely on this app as the sole basis for safety-critical or agricultural decisions.',
          'The service is provided subject to availability and may change as data providers change.'
        ]
      };

  return (
    <div className="settings-panel-overlay" onClick={onClose}>
      <div className="settings-panel-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-panel__header">
          <h2 className="settings-panel__title">{isHindi ? 'सेटिंग्स' : 'Settings'}</h2>
          <button className="settings-panel__close" onClick={onClose} aria-label="Close settings">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {documentView ? <section className="settings-document">
          <button className="settings-document__back" onClick={() => setDocumentView('')}>← {isHindi ? 'सेटिंग्स पर वापस' : 'Back to settings'}</button>
          <h3>{policyContent.title}</h3>
          {policyContent.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
        </section> : <>
          <section className="settings-section">
            <div className="settings-section__heading"><Sun size={17} /><h3>{isHindi ? 'दिखावट' : 'Appearance'}</h3></div>
            <div className="settings-theme-picker" role="group" aria-label={isHindi ? 'थीम चुनें' : 'Choose theme'}>
              <button className={theme === 'light' ? 'is-selected' : ''} onClick={() => setTheme('light')}><Sun size={17} /> {isHindi ? 'लाइट मोड' : 'Light mode'}</button>
              <button className={theme === 'dark' ? 'is-selected' : ''} onClick={() => setTheme('dark')}><Moon size={17} /> {isHindi ? 'डार्क मोड' : 'Dark mode'}</button>
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section__heading"><Globe size={17} /><h3>{isHindi ? 'भाषा' : 'Language'}</h3></div>
            <div className="settings-theme-picker" role="group" aria-label={isHindi ? 'भाषा चुनें' : 'Choose language'}>
              <button className={currentLang === 'en' ? 'is-selected' : ''} aria-pressed={currentLang === 'en'} onClick={() => setAppLanguage('en')}>English</button>
              <button className={currentLang === 'hi' ? 'is-selected' : ''} aria-pressed={currentLang === 'hi'} onClick={() => setAppLanguage('hi')}>हिंदी</button>
            </div>
          </section>
          <section className="settings-section">
            <div className="settings-section__heading"><Info size={17} /><h3>{isHindi ? 'ऐप जानकारी' : 'About WeatherGPT'}</h3></div>
            <div className="settings-info-row"><span>{isHindi ? 'ऐप संस्करण' : 'App version'}</span><strong>v{appMetadata.version}</strong></div>
            <details className="settings-credits">
              <summary><Database size={16} /> {isHindi ? 'डेटा स्रोत और श्रेय' : 'Data sources & credits'}</summary>
              <p className="settings-credits__note">{isHindi ? 'स्रोत स्थान और उपलब्धता के अनुसार बदलते हैं।' : 'Sources vary by location and availability; Open-Meteo supplies many point forecasts when a mapped official feed is unavailable.'}</p>
              {sourceCredits.map(([name, description]) => <div className="settings-credit-row" key={name}><strong>{name}</strong><span>{description}</span></div>)}
            </details>
          </section>
          <section className="settings-section settings-legal-links">
            <button onClick={() => setDocumentView('terms')}><FileText size={16} /><span>{isHindi ? 'नियम और शर्तें' : 'Terms of use'}</span><span aria-hidden="true">›</span></button>
            <button onClick={() => setDocumentView('privacy')}><ShieldCheck size={16} /><span>{isHindi ? 'गोपनीयता नीति' : 'Privacy policy'}</span><span aria-hidden="true">›</span></button>
          </section>
        </>}
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [activePage, setActivePage] = useState('chat');
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [weather, setWeather] = useState(null);
  const [severity, setSeverity] = useState('green');
  const [location, setLocation] = useState(null);
  // Dedicated state for user's actual live detected current location (never overridden by chat queries for other cities)
  const [currentLocation, setCurrentLocation] = useState(null);
  const [currentWeather, setCurrentWeather] = useState(null);
  const [selectedDistrictAlert, setSelectedDistrictAlert] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_open');
      if (saved !== null) return saved === 'true';
      return false; // Collapsed rail by default, just like ChatGPT!
    } catch {
      return false;
    }
  });
  const [sidebarSearchActive, setSidebarSearchActive] = useState(false);

  const handleToggleSidebar = (val) => {
    setSidebarOpen(prev => {
      const next = typeof val === 'boolean' ? val : !prev;
      try { localStorage.setItem('sidebar_open', String(next)); } catch {}
      return next;
    });
  };
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  const [userProfile, setUserProfile] = useState(null);
  const [currentLang, setCurrentLang] = useState('en');
  const [showAuthModal, setShowAuthModal] = useState(() => {
    try {
      const stored = localStorage.getItem('weathergpt_user_profile');
      return !stored;
    } catch {
      return true;
    }
  });
  const [showProfilePage, setShowProfilePage] = useState(false);

  const [showVoice, setShowVoice] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const chatRef = useRef(null);
  const inputRef = useRef(null);
  const recognitionRef = useRef(null);
  const speechAudioRef = useRef(null);

  // Load user + conversations on mount & listen to auth state
  useEffect(() => {
    const unsubscribe = observeAuthState(async (profile) => {
      if (profile) {
        setHistoryUser(profile.email);
        setUserProfile(profile);
        setShowAuthModal(false);
        if (profile.language) setCurrentLang(profile.language);
        const saved = loadAllConversations();
        setConversations(saved);
        // Always open a fresh new chat on visit instead of previous chat
        setActiveConvId(null);
        setMessages([]);
        try {
          const cloudConversations = await hydrateConversationsFromSupabase(profile.email);
          setConversations(cloudConversations);
          // Keep fresh new chat active
          syncAllConversationsToSupabase(profile.email).catch((error) => {
            console.warn('Supabase chat-history migration unavailable:', error.message);
          });
        } catch (error) {
          console.warn('Supabase chat-history sync unavailable; using local history.', error.message);
        }
      } else {
        // No logged-in user: automatically open sign in / sign up page
        setShowAuthModal(true);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const [isDetectingLocation, setIsDetectingLocation] = useState(false);

  const detectLiveLocation = useCallback(async (forceRefresh = false) => {
    setIsDetectingLocation(true);
    try {
      const pos = await getUserLocation(forceRefresh);
      let geo = {};
      if (pos.city && pos.country && pos.city !== 'Unknown' && pos.city !== 'Live Location') {
        geo = { city: pos.city, state: pos.state || '', country: pos.country || 'India' };
      } else {
        try {
          geo = await reverseGeocode(pos.lat, pos.lon);
        } catch (e) {
          console.warn('[Location] Reverse geocode error:', e);
        }
      }

      const cityName = (geo.city && geo.city !== 'Unknown')
        ? geo.city
        : (pos.city && pos.city !== 'Unknown')
          ? pos.city
          : 'Your Location';

      const locObj = {
        lat: Number(pos.lat),
        lon: Number(pos.lon),
        city: cityName,
        state: geo.state || pos.state || '',
        country: geo.country || pos.country || 'India',
        name: cityName,
        source: pos.source || 'gps',
        isApproximate: Boolean(pos.isApproximate),
      };

      setCurrentLocation(locObj);
      setLocation(locObj);

      const w = await getCurrentWeather(pos.lat, pos.lon);
      setCurrentWeather(w);
      setWeather(w);
      if (w.windSpeed > 60 || w.temp >= 42) setSeverity('red');
      else if (w.windSpeed > 40 || w.temp >= 40) setSeverity('orange');
      else if (w.windSpeed > 25 || w.temp >= 37) setSeverity('yellow');
      else setSeverity('green');
      return locObj;
    } catch (err) {
      console.error('[Location] Location detection failed:', err);
      const fb = { lat: 21.1915, lon: 81.2762, city: 'Durg', name: 'Durg', state: 'Chhattisgarh', country: 'India', source: 'fallback', isApproximate: true };
      setCurrentLocation(fb);
      setLocation(fb);
      try {
        const w = await getCurrentWeather(fb.lat, fb.lon);
        setCurrentWeather(w);
        setWeather(w);
      } catch {}
      return fb;
    } finally {
      setIsDetectingLocation(false);
    }
  }, []);

  useEffect(() => {
    // 1. Immediately hydrate from stored location if available for zero-latency initial UI
    const cached = getStoredLocation();
    if (cached?.lat && cached?.lon) {
      setCurrentLocation(cached);
      setLocation(cached);
      getCurrentWeather(cached.lat, cached.lon).then((w) => {
        setCurrentWeather(w);
        setWeather(w);
        if (w.windSpeed > 60 || w.temp >= 42) setSeverity('red');
        else if (w.windSpeed > 40 || w.temp >= 40) setSeverity('orange');
        else if (w.windSpeed > 25 || w.temp >= 37) setSeverity('yellow');
        else setSeverity('green');
      }).catch(() => {});
    }

    // 2. Automatically request user's true live location (GPS / Wi-Fi) without waiting
    detectLiveLocation(true);

    // 3. React instantly when the user clicks 'Allow' in the browser location prompt
    const unsubscribe = onLocationPermissionChange((permState) => {
      if (permState === 'granted') {
        detectLiveLocation(true);
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [detectLiveLocation]);

  const setAppLanguage = (langCode) => {
    setCurrentLang(langCode);
    if (userProfile) setUserProfile(prev => prev ? { ...prev, language: langCode } : null);
  };

  const toggleLanguage = () => setAppLanguage(currentLang === 'hi' ? 'en' : 'hi');

  const handleAuthSuccess = async (profileData) => {
    setHistoryUser(profileData?.email);
    setUserProfile(profileData);
    if (profileData?.language) setCurrentLang(profileData.language);
    const saved = loadAllConversations();
    setConversations(saved);
    // Always start on a fresh new chat
    setActiveConvId(null);
    setMessages([]);
    try {
      const cloudConversations = await hydrateConversationsFromSupabase(profileData?.email);
      setConversations(cloudConversations);
      // Keep fresh new chat active
      syncAllConversationsToSupabase(profileData?.email).catch((error) => {
        console.warn('Supabase chat-history migration unavailable:', error.message);
      });
    } catch (error) {
      console.warn('Supabase chat-history sync unavailable; using local history.', error.message);
    }
  };

  const handleLogout = async () => {
    await signOutUser();
    setHistoryUser(null);
    setUserProfile(null);
    setConversations([]);
    setActiveConvId(null);
    setMessages([]);
    setShowAuthModal(true);
  };

  const handleBecomeFarmer = async () => {
    const updated = { ...(userProfile || {}), occupation: 'Farmer' };
    setUserProfile(updated);
    try {
      await updateUserProfile({ occupation: 'Farmer' });
    } catch (e) {
      console.warn('Failed to update occupation to Farmer:', e);
    }
  };

  const handleNewChat = () => {
    const conv = createConversation(currentLang);
    setConversations(loadAllConversations());
    setActiveConvId(conv.id);
    setMessages([]);
  };

  const handleSelectConversation = (id) => {
    const all = loadAllConversations();
    const conv = all.find(c => c.id === id);
    if (conv) {
      setActiveConvId(conv.id);
      setMessages(conv.messages.map(m => ({ ...m, timestamp: new Date(m.timestamp) })));
    }
  };

  const handleDeleteConversation = (id) => {
    const remaining = deleteConversation(id);
    setConversations(remaining);
    if (activeConvId === id) {
      if (remaining.length > 0) { handleSelectConversation(remaining[0].id); }
      else { setActiveConvId(null); setMessages([]); }
    }
    deleteConversationFromSupabase(userProfile?.email, id).catch((error) => {
      console.warn('Supabase conversation delete failed:', error.message);
    });
  };

  const sendMessage = useCallback(async (text, { speakResponse = false } = {}) => {
    if (!text.trim()) return;

    // Switch to chat page when sending a message
    setActivePage('chat');

    let convId = activeConvId;
    if (!convId) {
      const conv = createConversation(currentLang);
      convId = conv.id;
      setActiveConvId(convId);
    }

    const userMsg = { id: Date.now(), role: 'user', text: text.trim(), timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputValue('');
    setIsTyping(true);

    saveConversation(convId, newMessages, currentLang);
    setConversations(loadAllConversations());
    syncConversationToSupabase(userProfile?.email, convId).catch((error) => {
      console.warn('Supabase conversation sync failed:', error.message);
    });

    try {
      const activeProfile = userProfile ? { ...userProfile, language: currentLang } : { language: currentLang };
      const response = await processQuery(text, currentLocation || location, messages, activeProfile);
      const botMsg = {
        id: Date.now() + 1, role: 'bot', text: response.text,
        type: response.type, data: response.data, severity: response.severity,
        source: response.source, timestamp: new Date(),
        location: response.location, weather: response.weather,
      };
      if (response.severity) setSeverity(response.severity);
      // ONLY update the dashboard's current location if the query explicitly requested live user location detection
      if (response.isUserLocation && response.location) {
        setCurrentLocation(response.location);
        if (response.weather) setCurrentWeather(response.weather);
        setLocation(response.location);
        if (response.weather) setWeather(response.weather);
      }

      setTimeout(() => {
        setIsTyping(false);
        const updated = [...newMessages, botMsg];
        setMessages(updated);
        saveConversation(convId, updated, currentLang);
        setConversations(loadAllConversations());
        syncConversationToSupabase(userProfile?.email, convId).catch((error) => {
          console.warn('Supabase conversation sync failed:', error.message);
        });
        if (speakResponse) {
          setIsSpeaking(true);
          speakSarvamText(botMsg.text, currentLang === 'hi' ? 'hi-IN' : 'en-IN')
            .then((audio) => {
              speechAudioRef.current = audio;
              audio.onended = () => setIsSpeaking(false);
              audio.onerror = () => setIsSpeaking(false);
            })
            .catch((error) => { setIsSpeaking(false); console.warn('Voice response failed:', error.message); });
        }
      }, 400 + Math.random() * 400);
    } catch {
      setIsTyping(false);
      const errMsg = {
        id: Date.now() + 1, role: 'bot', type: 'text', timestamp: new Date(),
        text: currentLang === 'hi' ? 'मौसम सेवा से जुड़ने में त्रुटि हुई।' : 'An error occurred connecting to weather services.',
      };
      const updated = [...newMessages, errMsg];
      setMessages(updated);
      saveConversation(convId, updated, currentLang);
      setConversations(loadAllConversations());
      syncConversationToSupabase(userProfile?.email, convId).catch((error) => {
        console.warn('Supabase conversation sync failed:', error.message);
      });
      if (speakResponse) {
        setIsSpeaking(true);
        speakSarvamText(errMsg.text, currentLang === 'hi' ? 'hi-IN' : 'en-IN')
          .then((audio) => { speechAudioRef.current = audio; audio.onended = () => setIsSpeaking(false); audio.onerror = () => setIsSpeaking(false); })
          .catch((error) => { setIsSpeaking(false); console.warn('Voice error response failed:', error.message); });
      }
    }
  }, [activeConvId, location, currentLang, userProfile, messages]);

  const handleEditMessage = useCallback(async (messageId, newText) => {
    if (!newText || !newText.trim()) return;
    const index = messages.findIndex(m => m.id === messageId);
    if (index === -1) return;

    let convId = activeConvId;
    if (!convId) {
      const conv = createConversation(currentLang);
      convId = conv.id;
      setActiveConvId(convId);
    }

    const previousHistory = messages.slice(0, index);
    const updatedUserMsg = {
      ...messages[index],
      text: newText.trim(),
      timestamp: new Date(),
      isEdited: true
    };
    const baseMessages = [...previousHistory, updatedUserMsg];
    setMessages(baseMessages);
    setIsTyping(true);

    saveConversation(convId, baseMessages, currentLang);
    setConversations(loadAllConversations());
    syncConversationToSupabase(userProfile?.email, convId).catch((error) => {
      console.warn('Supabase conversation sync failed:', error.message);
    });

    try {
      const activeProfile = userProfile ? { ...userProfile, language: currentLang } : { language: currentLang };
      const response = await processQuery(newText.trim(), currentLocation || location, previousHistory, activeProfile);
      const botMsg = {
        id: Date.now() + 1,
        role: 'bot',
        text: response.text,
        type: response.type,
        data: response.data,
        severity: response.severity,
        source: response.source,
        timestamp: new Date(),
        location: response.location,
        weather: response.weather,
      };
      if (response.severity) setSeverity(response.severity);
      if (response.isUserLocation && response.location) {
        setCurrentLocation(response.location);
        if (response.weather) setCurrentWeather(response.weather);
        setLocation(response.location);
        if (response.weather) setWeather(response.weather);
      }

      setTimeout(() => {
        setIsTyping(false);
        const finalUpdated = [...baseMessages, botMsg];
        setMessages(finalUpdated);
        saveConversation(convId, finalUpdated, currentLang);
        setConversations(loadAllConversations());
        syncConversationToSupabase(userProfile?.email, convId).catch((error) => {
          console.warn('Supabase conversation sync failed:', error.message);
        });
      }, 400 + Math.random() * 400);
    } catch {
      setIsTyping(false);
      const errMsg = {
        id: Date.now() + 1,
        role: 'bot',
        type: 'text',
        timestamp: new Date(),
        text: currentLang === 'hi' ? 'मौसम सेवा से जुड़ने में त्रुटि हुई।' : 'An error occurred connecting to weather services.',
      };
      const finalUpdated = [...baseMessages, errMsg];
      setMessages(finalUpdated);
      saveConversation(convId, finalUpdated, currentLang);
      setConversations(loadAllConversations());
      syncConversationToSupabase(userProfile?.email, convId).catch((error) => {
        console.warn('Supabase conversation sync failed:', error.message);
      });
    }
  }, [activeConvId, location, currentLang, userProfile, messages]);

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(inputValue); };

  const startVoice = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Speech recognition is not supported in this browser. Please use Chrome.');
      return;
    }
    setShowVoice(true);
    setTranscript('');
    const recognition = new SpeechRecognition();
    recognition.lang = currentLang === 'hi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const result = Array.from(event.results).map((item) => item[0].transcript).join('');
      setTranscript(result);
      const lastResult = event.results[event.results.length - 1];
      if (lastResult?.isFinal) {
        setIsListening(false);
        setTimeout(() => { setShowVoice(false); sendMessage(result, { speakResponse: true }); }, 350);
      }
    };
    recognition.onnomatch = () => {
      setIsListening(false);
      setTranscript(currentLang === 'hi' ? 'आवाज़ समझ में नहीं आई। फिर से कोशिश करें।' : "I couldn't understand that. Please try again.");
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      const messages = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access in your browser settings and try again.',
        'service-not-allowed': 'Speech recognition is blocked by this browser or network.',
        'network': 'Speech recognition needs an internet connection.',
        'no-speech': 'No speech was detected. Please speak and try again.',
        'audio-capture': 'No microphone was found or it is in use by another app.',
      };
      setTranscript(messages[event.error] || `Speech recognition failed: ${event.error}`);
    };
    recognition.onend = () => setIsListening(false);
    try {
      recognition.start();
    } catch (error) {
      setIsListening(false);
      setTranscript(error.message || 'Unable to start speech recognition.');
    }
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    setShowVoice(false);
  };

  const stopSpeaking = () => {
    if (speechAudioRef.current) {
      speechAudioRef.current.pause();
      speechAudioRef.current.currentTime = 0;
      speechAudioRef.current = null;
    }
    setIsSpeaking(false);
  };

  const t = (key) => getTranslation(key, currentLang);

  const handleSearch = async (query) => {
    if (!query || !query.trim()) return;
    const clean = query.trim();
    // Geocode to see if this matches a city and update active location
    try {
      const place = await geocodeCity(clean);
      if (place?.lat && place?.lon) {
        const newLoc = {
          lat: Number(place.lat),
          lon: Number(place.lon),
          city: place.name,
          name: place.name,
          state: place.admin1 || '',
          country: place.country || 'India',
          source: 'search',
          isApproximate: false,
        };
        setLocation(newLoc);
        getCurrentWeather(newLoc.lat, newLoc.lon).then((w) => {
          setWeather(w);
          if (w.windSpeed > 60 || w.temp >= 42) setSeverity('red');
          else if (w.windSpeed > 40 || w.temp >= 40) setSeverity('orange');
          else if (w.windSpeed > 25 || w.temp >= 37) setSeverity('yellow');
          else setSeverity('green');
        }).catch(() => {});
      }
    } catch {}
    sendMessage(clean);
  };

  const handlePromptClick = (text) => {
    sendMessage(text);
  };

  const handleNavigate = (pageId) => {
    if (pageId === 'settings' || pageId === 'data') {
      setShowSettings(true);
      return;
    }
    if (pageId === 'multilingual') {
      toggleLanguage();
      return;
    }
    setActivePage(pageId);
  };

  const getPageTitle = () => {
    const titles = {
      home: 'Dashboard',
      chat: 'AI Chat',
      forecast: 'Forecast',
      maps: 'Weather Map',
      alerts: 'Disaster Alerts',
      agriculture: 'Agriculture',
      climate: 'Climate Insights',
    };
    return titles[activePage] || 'Dashboard';
  };

  // Full-screen profile page
  if (showProfilePage) {
    return (
      <ProfilePage
        userProfile={userProfile} location={location} onProfileUpdate={handleAuthSuccess}
        currentLang={currentLang} setAppLanguage={setAppLanguage}
        onBackToChat={() => setShowProfilePage(false)}
        onLogout={() => { setShowProfilePage(false); handleLogout(); }}
      />
    );
  }

  const renderMainContent = () => {
    switch (activePage) {
      case 'home':
        return (
          <HomePage
            weather={currentWeather || weather}
            location={currentLocation || location}
            onPromptClick={handlePromptClick}
            currentLang={currentLang}
            onNavigateForecast={() => handleNavigate('forecast')}
            onNavigateAlerts={() => handleNavigate('alerts')}
          />
        );

      case 'chat':
        return (
          <div className="chat-page">
            <div className="chat-page__messages" ref={chatRef}>
              {messages.length === 0 ? (
                <ChatEmptyState onQuestionClick={sendMessage} currentLang={currentLang} />
              ) : (
                messages.map(msg => <Message key={msg.id} message={msg} onEditMessage={handleEditMessage} />)
              )}
              {isTyping && <TypingIndicator />}
            </div>
            <div className="chat-page__input-area">
              <form className="chatbar" onSubmit={handleSubmit}>
                <textarea
                  ref={inputRef}
                  className="chatbar__textarea"
                  placeholder={t('inputPlaceholder')}
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onInput={e => {
                    e.target.style.height = 'auto';
                    e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (inputValue.trim()) handleSubmit(e);
                    }
                  }}
                  id="chat-input"
                  aria-label="Chat message input"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                  rows={1}
                />
                <div className="chatbar__actions">
                  <button type="button" className="chatbar__voice-pill" onClick={startVoice} title="Start Voice Input" aria-label="Start voice input">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="6" width="2.5" height="12" rx="1.25" fill="currentColor" opacity="0.5"/>
                      <rect x="8.5" y="3" width="2.5" height="18" rx="1.25" fill="currentColor"/>
                      <rect x="13" y="7" width="2.5" height="10" rx="1.25" fill="currentColor" opacity="0.7"/>
                      <rect x="17.5" y="4" width="2.5" height="16" rx="1.25" fill="currentColor" opacity="0.85"/>
                    </svg>
                    <span>Start Voice</span>
                  </button>
                  <button type="submit" className="chatbar__send-btn" disabled={!inputValue.trim()} id="send-button" aria-label="Send message">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 19V5M5 12l7-7 7 7"/>
                    </svg>
                  </button>
                </div>
              </form>
              {isSpeaking && (
                <button className="chat-page__stop-speaking" onClick={stopSpeaking}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  Stop speaking
                </button>
              )}
            </div>
          </div>
        );

      case 'forecast':
        return <ForecastPage location={location} onBackToChat={() => handleNavigate('chat')} />;

      case 'alerts':
        return (
          <AlertsPage
            location={location}
            currentLang={currentLang}
            districtAlert={selectedDistrictAlert}
            onBackToChat={() => handleNavigate('chat')}
          />
        );

      case 'maps':
        return <WeatherMap location={location} onBack={() => handleNavigate('home')} onOpenDistrictWarning={(alert) => { setSelectedDistrictAlert(alert); setActivePage('alerts'); }} />;

      case 'agriculture': {
        const isFarmer = userProfile?.occupation === 'Farmer';
        if (!isFarmer) {
          return (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '65vh',
              textAlign: 'center',
              padding: '32px 20px',
              maxWidth: '620px',
              margin: '40px auto 0',
              background: 'var(--bg-card, #111827)',
              borderRadius: '20px',
              border: '1px solid rgba(132, 204, 22, 0.3)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
            }}>
              <div style={{
                width: '76px',
                height: '76px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(132, 204, 22, 0.25), rgba(16, 185, 129, 0.2))',
                border: '2px solid rgba(132, 204, 22, 0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '36px',
                marginBottom: '18px',
                boxShadow: '0 8px 30px rgba(132, 204, 22, 0.25)'
              }}>
                🌾
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {currentLang === 'hi' ? 'केवल पंजीकृत किसानों के लिए' : 'Farmer Exclusive Portal'}
              </h2>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '24px', maxWidth: '480px' }}>
                {currentLang === 'hi'
                  ? 'यह विशेष क्रॉप एडवाइजरी व मौसम मार्गदर्शन पृष्ठ केवल किसान (Farmer) के रूप में पंजीकृत उपयोगकर्ताओं के लिए सुरक्षित है।'
                  : 'This specialized Crop Advisory portal is exclusively crafted for registered Farmers to receive actionable agromet weather guidance.'}
              </p>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
                <button
                  onClick={handleBecomeFarmer}
                  style={{
                    padding: '12px 22px',
                    borderRadius: '12px',
                    background: 'linear-gradient(135deg, #16a34a, #22c55e)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 4px 16px rgba(34, 197, 94, 0.3)'
                  }}
                >
                  🌾 {currentLang === 'hi' ? 'किसान प्रोफेशन सेट करें' : 'Switch Profession to Farmer'}
                </button>
                <button
                  onClick={() => handleNavigate('home')}
                  style={{
                    padding: '12px 22px',
                    borderRadius: '12px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-color)',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  {currentLang === 'hi' ? 'मुख्य पृष्ठ पर लौटें' : 'Back to Dashboard'}
                </button>
              </div>
            </div>
          );
        }

        return (
          <AgricultureAdvisory
            location={location}
            currentLang={currentLang}
            userProfile={userProfile}
            onBack={() => handleNavigate('home')}
            onNavigateChat={() => handleNavigate('chat')}
          />
        );
      }

      case 'climate':
        return <ClimateInsights location={location} />;

      default:
        return (
          <HomePage
            weather={currentWeather || weather}
            location={currentLocation || location}
            onPromptClick={handlePromptClick}
            currentLang={currentLang}
            onNavigateForecast={() => handleNavigate('forecast')}
            onNavigateAlerts={() => handleNavigate('alerts')}
          />
        );
    }
  };

  return (
    <div className="app-layout">
      {/* ChatGPT-style Collapsed Sidebar Rail */}
      {!sidebarOpen && (
        <SidebarRail
          onToggleSidebar={() => handleToggleSidebar(true)}
          onNew={handleNewChat}
          onNavigate={handleNavigate}
          activePage={activePage}
          onOpenSearch={() => {
            handleToggleSidebar(true);
            setSidebarSearchActive(true);
          }}
          onOpenRecent={() => {
            handleToggleSidebar(true);
            setSidebarSearchActive(false);
          }}
          onOpenSettings={() => setShowSettings(true)}
          userProfile={userProfile}
          onOpenAuth={() => setShowAuthModal(true)}
          onOpenProfile={() => setShowProfilePage(true)}
        />
      )}

      {/* Full Expanded Sidebar */}
      <Sidebar
        conversations={conversations} activeId={activeConvId}
        onSelect={handleSelectConversation} onNew={handleNewChat}
        onDelete={handleDeleteConversation} userProfile={userProfile}
        onOpenAuth={() => setShowAuthModal(true)} onOpenProfile={() => setShowProfilePage(true)}
        onOpenSettings={() => setShowSettings(true)}
        onLogout={handleLogout} currentLang={currentLang} onToggleLang={toggleLanguage}
        isOpen={sidebarOpen} onClose={() => handleToggleSidebar(false)}
        activePage={activePage} onNavigate={handleNavigate}
        initialSearchOpen={sidebarSearchActive}
        onResetSearch={() => setSidebarSearchActive(false)}
      />

      <div className="app-main">
        <TopBar
          activePage={activePage}
          onNavigate={handleNavigate}
          onNavigateForecast={() => handleNavigate('forecast')}
          weather={currentWeather || weather}
          location={currentLocation || location}
          userProfile={userProfile}
          onSearch={handleSearch}
          onOpenAuth={() => setShowAuthModal(true)}
          onToggleMenu={() => handleToggleSidebar()}
          onDetectLocation={() => detectLiveLocation(true)}
          isDetectingLocation={isDetectingLocation}
        />

        <div className="app-workspace">
          <main className="main-content" role="main">
            {renderMainContent()}
          </main>

          {activePage === 'home' && (
            <RightPanel
              weather={currentWeather || weather}
              location={currentLocation || location}
              onNavigateAlerts={() => setActivePage('alerts')}
              onNavigateMaps={() => setActivePage('maps')}
            />
          )}
        </div>
      </div>

      {showVoice && (
        <VoiceOverlay isListening={isListening} transcript={transcript} onClose={stopVoice} currentLang={currentLang} />
      )}

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} theme={theme} setTheme={setTheme} currentLang={currentLang} setAppLanguage={setAppLanguage} />
      )}

      {showAuthModal && (
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)}
          onAuthSuccess={handleAuthSuccess} currentLang={currentLang} setAppLanguage={setAppLanguage}
        />
      )}
    </div>
  );
}
