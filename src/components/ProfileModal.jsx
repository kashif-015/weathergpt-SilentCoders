import { useState, useEffect } from 'react';
import { updateUserProfile } from '../services/supabaseClient.js';
import { getTranslation } from '../services/translations.js';
import { X, CheckCircle2, Briefcase, Cake, Globe, Bot, Edit3, LogOut } from 'lucide-react';

export default function ProfileModal({ isOpen, onClose, userProfile, onProfileUpdate, currentLang, setAppLanguage, onLogout }) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('Farmer');
  const [language, setLanguage] = useState(currentLang || 'en');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setOccupation(userProfile.occupation || 'Farmer');
      setLanguage(userProfile.language || currentLang || 'en');
      setAge(userProfile.age || '');
    }
  }, [userProfile, currentLang]);

  if (!isOpen) return null;

  const t = (key) => getTranslation(key, language);

  const handleLanguageSelect = (langCode) => {
    setLanguage(langCode);
    setAppLanguage(langCode);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMsg('');

    try {
      const updated = await updateUserProfile({
        name: name.trim(),
        occupation,
        language,
        age: age ? parseInt(age, 10) : null,
      });

      setMsg(t('profileUpdated'));
      onProfileUpdate(updated);

      setTimeout(() => {
        setLoading(false);
        setIsEditing(false);
      }, 600);
    } catch (err) {
      setLoading(false);
      setMsg('Error: ' + err.message);
    }
  };

  const firstLetter = (userProfile?.name || name || 'U').charAt(0).toUpperCase();

  const getOccupationLabel = (occ) => {
    const key = (occ || 'farmer').toLowerCase().replace(/\s+/g, '');
    return t('occupations')[key] || occ;
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal profile-card-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        {/* Profile Card View Mode */}
        {!isEditing ? (
          <div className="profile-view">
            <div className="profile-view__header">
              <div className="profile-view__avatar">{firstLetter}</div>
              <h2 className="profile-view__name">{userProfile?.name || name || 'User Profile'}</h2>
              <p className="profile-view__email">{userProfile?.email || 'Authenticated User'}</p>
              <div className="profile-view__badge">{t('verifiedAccount')}</div>
            </div>

            {msg && (
              <div className="auth-alert auth-alert--success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> {msg}
              </div>
            )}

            <div className="profile-view__grid">
              <div className="profile-stat-card">
                <span className="profile-stat-card__icon">
                  <Briefcase size={20} color="#3b82f6" />
                </span>
                <div>
                  <div className="profile-stat-card__label">{t('occupationLabel')}</div>
                  <div className="profile-stat-card__value">{getOccupationLabel(userProfile?.occupation || occupation)}</div>
                </div>
              </div>

              <div className="profile-stat-card">
                <span className="profile-stat-card__icon">
                  <Cake size={20} color="#ec4899" />
                </span>
                <div>
                  <div className="profile-stat-card__label">{t('ageLabel').split(' ')[0]}</div>
                  <div className="profile-stat-card__value">
                    {userProfile?.age || age ? `${userProfile?.age || age} ${language === 'hi' ? 'वर्ष' : 'Years'}` : '--'}
                  </div>
                </div>
              </div>

              <div className="profile-stat-card">
                <span className="profile-stat-card__icon">
                  <Globe size={20} color="#10b981" />
                </span>
                <div>
                  <div className="profile-stat-card__label">{t('languageLabel')}</div>
                  <div className="profile-stat-card__value">
                    {(userProfile?.language || language) === 'hi' ? 'हिंदी (Hindi)' : 'English'}
                  </div>
                </div>
              </div>
            </div>

            {/* AI Personalization Advisory Info */}
            <div className="profile-advisory-box">
              <div className="profile-advisory-box__title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={18} color="#8b5cf6" /> {t('personalizationHeading')}
              </div>
              <p className="profile-advisory-box__desc">
                {t('occupationAdvisoryInfo')}
              </p>
            </div>

            {/* Actions */}
            <div className="profile-view__actions">
              <button
                className="profile-btn profile-btn--edit"
                onClick={() => setIsEditing(true)}
              >
                <Edit3 size={15} style={{ marginRight: 6 }} /> {t('editProfile')}
              </button>

              <button
                className="profile-btn profile-btn--lang"
                onClick={() => handleLanguageSelect(language === 'hi' ? 'en' : 'hi')}
              >
                <Globe size={15} style={{ marginRight: 6 }} /> {language === 'hi' ? 'Switch to English' : 'हिंदी में बदलें'}
              </button>

              {onLogout && (
                <button
                  className="profile-btn profile-btn--logout"
                  onClick={() => { onClose(); onLogout(); }}
                >
                  <LogOut size={15} style={{ marginRight: 6 }} /> {t('logout')}
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Profile Edit Mode */
          <div className="profile-edit-mode">
            <div className="auth-modal__header">
              <div className="auth-modal__logo">
                <Edit3 size={28} color="var(--color-primary-light)" />
              </div>
              <h2>{t('editProfile')}</h2>
              <p className="auth-modal__subtitle">
                {language === 'hi' ? 'अपनी व्यक्तिगत मौसम प्राथमिकताएं व जानकारी अपडेट करें' : 'Update your personal weather advisories profile'}
              </p>
            </div>

            {msg && (
              <div className="auth-alert auth-alert--success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> {msg}
              </div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-form__group">
                <label>{t('nameLabel')} *</label>
                <input
                  type="text"
                  placeholder={t('namePlaceholder')}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div className="auth-form__row">
                <div className="auth-form__group">
                  <label>{t('occupationLabel')} *</label>
                  <select
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    required
                  >
                    <option value="Farmer">{t('occupations').farmer}</option>
                    <option value="Student">{t('occupations').student}</option>
                    <option value="Software Tech">{t('occupations').tech}</option>
                    <option value="Business">{t('occupations').business}</option>
                    <option value="Weather Researcher">{t('occupations').researcher}</option>
                    <option value="Government Servant">{t('occupations').govt}</option>
                    <option value="Other">{t('occupations').other}</option>
                  </select>
                </div>

                <div className="auth-form__group">
                  <label>{t('ageLabel')} *</label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    placeholder={t('agePlaceholder')}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="auth-form__group">
                <label>{t('languageLabel')} * ({language === 'hi' ? 'हिंदी चुनने पर पूरा ऐप हिंदी में हो जाएगा' : 'Selecting Hindi converts full app to Hindi'})</label>
                <div className="lang-selector-buttons">
                  <button
                    type="button"
                    className={`lang-choice-btn ${language === 'en' ? 'lang-choice-btn--active' : ''}`}
                    onClick={() => handleLanguageSelect('en')}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    className={`lang-choice-btn ${language === 'hi' ? 'lang-choice-btn--active' : ''}`}
                    onClick={() => handleLanguageSelect('hi')}
                  >
                    🇮🇳 हिंदी (Hindi)
                  </button>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="auth-submit-btn"
                  style={{ background: 'var(--surface-card)', color: 'var(--text-secondary)' }}
                  onClick={() => setIsEditing(false)}
                >
                  {language === 'hi' ? 'रद्द करें' : 'Cancel'}
                </button>
                <button type="submit" className="auth-submit-btn" style={{ flex: 1 }} disabled={loading}>
                  {loading ? (language === 'hi' ? 'सहेजा जा रहा है...' : 'Saving...') : t('saveProfileBtn')}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
