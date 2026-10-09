import { useState } from 'react';
import { ArrowLeft, Check, Globe2, LogOut, Mail, MapPin, Pencil, UserRound, Wheat } from 'lucide-react';
import { getTranslation } from '../services/translations.js';
import { updateUserProfile } from '../services/firebaseClient.js';
import weatherGPTLogo from '../assets/weatherGPT_logo.png';

export default function ProfilePage({ userProfile, location, onProfileUpdate, currentLang, setAppLanguage, onBackToChat, onLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(userProfile?.name || '');
  const [occupation, setOccupation] = useState(userProfile?.occupation || 'Farmer');
  const [language, setLanguage] = useState(userProfile?.language || currentLang || 'hi');
  const [age, setAge] = useState(userProfile?.age || '');
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const t = (key) => getTranslation(key, language);
  const firstLetter = (userProfile?.name || name || 'U').charAt(0).toUpperCase();
  const displayName = userProfile?.name || name || 'WeatherGPT User';
  const displayLanguage = (userProfile?.language || language) === 'hi' ? 'हिंदी (Hindi)' : 'English';
  const currentLocation = location?.name || location?.city || location?.locationName || '';
  const getOccupationLabel = (value) => {
    const key = (value || 'farmer').toLowerCase().replace(/\s+/g, '');
    return t('occupations')[key] || value || '—';
  };

  const handleLanguageSelect = (code) => {
    setLanguage(code);
    setAppLanguage(code);
  };

  const handleSaveProfile = async (event) => {
    event.preventDefault();
    setLoading(true);
    setSaveMsg('');
    try {
      const updated = await updateUserProfile({ name: name.trim(), occupation, language, age: age ? parseInt(age, 10) : null });
      onProfileUpdate(updated);
      setSaveMsg(t('profileUpdated'));
      setIsEditing(false);
    } catch (error) {
      setSaveMsg(`${language === 'hi' ? 'त्रुटि' : 'Error'}: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="profile-page">
      <header className="profile-navbar">
        <button className="profile-back-btn" onClick={onBackToChat}><ArrowLeft size={17} /> {language === 'hi' ? 'चैट पर वापस जाएं' : 'Back to chat'}</button>
        <div className="profile-navbar__center">
          <img src={weatherGPTLogo} alt="" className="profile-navbar__logo-img" />
          <span className="profile-navbar__title">{t('appName')}</span>
        </div>
        <span className="profile-navbar__right" />
      </header>

      <main className="profile-container profile-clean">
        <div className="profile-page-heading">
          <span className="profile-eyebrow">{language === 'hi' ? 'आपका खाता' : 'YOUR ACCOUNT'}</span>
          <button className="profile-logout-btn profile-heading-logout" onClick={onLogout}><LogOut size={16} /> {t('logout')}</button>
        </div>

        <section className="profile-hero-card profile-clean-hero">
          <div className="profile-hero__avatar">{firstLetter}</div>
          <div className="profile-clean-identity">
            <h2>{displayName}</h2>
            <div className="profile-clean-email"><Mail size={15} /> {userProfile?.email || '—'}</div>
            <div className="profile-clean-tags"><span><Wheat size={14} /> {getOccupationLabel(userProfile?.occupation || occupation)}</span><span><Globe2 size={14} /> {displayLanguage}</span></div>
          </div>
        </section>

        {saveMsg && <div className={`profile-save-message ${saveMsg.startsWith('Error') || saveMsg.startsWith('त्रुटि') ? 'is-error' : ''}`}><Check size={16} /> {saveMsg}</div>}

        {isEditing ? (
          <section className="profile-section-card profile-clean-card">
            <div className="profile-card-heading"><div className="profile-card-icon"><UserRound size={18} /></div><div><h2>{t('editProfile')}</h2><p>{language === 'hi' ? 'अपनी प्रोफ़ाइल जानकारी अपडेट करें' : 'Update the details associated with your account.'}</p></div></div>
            <form onSubmit={handleSaveProfile} className="profile-edit-form">
              <label>{t('nameLabel')}<input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></label>
              <label>{t('emailLabel')}<input type="email" value={userProfile?.email || ''} disabled /></label>
              <div className="profile-form-row">
                <label>{t('occupationLabel')}<select value={occupation} onChange={(e) => setOccupation(e.target.value)} required>
                  <option value="Farmer">{t('occupations').farmer}</option><option value="Student">{t('occupations').student}</option><option value="Software Tech">{t('occupations').tech}</option><option value="Business">{t('occupations').business}</option><option value="Weather Researcher">{t('occupations').researcher}</option><option value="Government Servant">{t('occupations').govt}</option><option value="Other">{t('occupations').other}</option>
                </select></label>
                <label>{t('ageLabel')}<input type="number" min="1" max="120" value={age} onChange={(e) => setAge(e.target.value)} /></label>
              </div>
              <fieldset><legend>{t('languageLabel')}</legend><div className="profile-language-options">
                <button type="button" className={language === 'en' ? 'selected' : ''} onClick={() => handleLanguageSelect('en')}>English</button>
                <button type="button" className={language === 'hi' ? 'selected' : ''} onClick={() => handleLanguageSelect('hi')}>हिंदी (Hindi)</button>
              </div></fieldset>
              <div className="profile-form-actions"><button type="button" className="profile-cancel-btn" onClick={() => setIsEditing(false)}>{language === 'hi' ? 'रद्द करें' : 'Cancel'}</button><button type="submit" className="profile-save-btn" disabled={loading}>{loading ? (language === 'hi' ? 'सहेजा जा रहा है…' : 'Saving…') : t('saveProfileBtn')}</button></div>
            </form>
          </section>
        ) : (
          <>
          <section className="profile-section-card profile-clean-card">
            <div className="profile-card-heading"><div className="profile-card-icon"><UserRound size={18} /></div><div className="profile-card-copy"><h2>{language === 'hi' ? 'खाता जानकारी' : 'Account information'}</h2><p>{language === 'hi' ? 'आपकी प्रोफ़ाइल और वर्तमान मौसम स्थान' : 'Your profile details and current weather location.'}</p></div><button className="profile-card-edit" onClick={() => { setIsEditing(true); setSaveMsg(''); }}><Pencil size={13} /> {language === 'hi' ? 'संपादित करें' : 'Edit Profile'}</button></div>
            <div className="profile-detail-grid">
              <div><span>{t('nameLabel')}</span><strong>{displayName}</strong></div>
              <div><span>{t('emailLabel')}</span><strong>{userProfile?.email || '—'}</strong></div>
              <div><span>{t('occupationLabel')}</span><strong>{getOccupationLabel(userProfile?.occupation || occupation)}</strong></div>
              <div><span>{t('ageLabel')}</span><strong>{userProfile?.age || age || '—'}</strong></div>
              <div><span>{t('languageLabel')}</span><strong>{displayLanguage}</strong></div>
              <div><span>{language === 'hi' ? 'वर्तमान स्थान' : 'Current location'}</span><strong><MapPin size={15} /> {currentLocation || (language === 'hi' ? 'उपलब्ध नहीं' : 'Unavailable')}</strong></div>
            </div>
          </section>
          </>
        )}
      </main>
    </div>
  );
}
