import { useState } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle } from '../services/firebaseClient.js';
import { getTranslation } from '../services/translations.js';
import { CloudSun, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import weatherGPTLogo from '../assets/weatherGPT_logo.png';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, currentLang, setAppLanguage }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('Farmer');
  const [language, setLanguage] = useState(currentLang || 'en');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  if (!isOpen) return null;

  const t = (key) => getTranslation(key, language);

  const handleLanguageSelect = (langCode) => {
    setLanguage(langCode);
    setAppLanguage(langCode);
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      const result = await signInWithGoogle();
      onAuthSuccess(result.profile);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || t('authError'));
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (mode === 'register') {
      if (!name.trim() || !email.trim() || !password.trim() || !age) {
        setErrorMsg(t('fillAllFields'));
        return;
      }
      if (password.length < 6) {
        setErrorMsg(language === 'hi' ? 'पासवर्ड कम से कम 6 अक्षरों का होना चाहिए।' : 'Password must be at least 6 characters.');
        return;
      }
    } else {
      if (!email.trim() || !password.trim()) {
        setErrorMsg(language === 'hi' ? 'कृपया ईमेल और पासवर्ड दर्ज करें।' : 'Please enter email and password.');
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === 'register') {
        const result = await signUpWithEmail({
          email: email.trim(),
          password: password.trim(),
          name: name.trim(),
          occupation,
          language,
          age,
        });

        setSuccessMsg('Account created. Check your inbox and verify your email before signing in.');
        setLoading(false);
        if (!result.verificationRequired) {
          onAuthSuccess(result.profile);
          onClose();
        }
      } else {
        const result = await signInWithEmail({
          email: email.trim(),
          password: password.trim(),
        });

        setSuccessMsg(t('loginSuccess'));
        setLoading(false);
        onAuthSuccess(result.profile);
        onClose();
      }
    } catch (err) {
      setLoading(false);
      setErrorMsg(err.message || t('authError'));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
        <button className="auth-modal__close" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>

        <div className="auth-modal__header">
          <div className="auth-modal__logo">
            <img src={weatherGPTLogo} alt="WeatherGPT" className="auth-modal__logo-img" />
          </div>
          <h2>{mode === 'login' ? t('loginModalTitle') : t('registerModalTitle')}</h2>
          <p className="auth-modal__subtitle">
            {mode === 'login'
              ? (language === 'hi' ? 'अपने WeatherGPT खाते में प्रवेश करें' : 'Sign in to access personalized weather AI')
              : (language === 'hi' ? 'निजीकृत सलाह एवं पूर्वानुमान के लिए पंजीकरण करें' : 'Create an account for personalized advisories & forecast')}
          </p>
        </div>

        {/* Auth Tabs */}
        <div className="auth-modal__tabs">
          <button
            className={`auth-modal__tab ${mode === 'login' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            {t('loginSubmitBtn')}
          </button>
          <button
            className={`auth-modal__tab ${mode === 'register' ? 'auth-modal__tab--active' : ''}`}
            onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); }}
          >
            {t('registerModalTitle').includes('पंजीकरण') ? 'पंजीकरण (Register)' : 'Register'}
          </button>
        </div>

        {/* Google Auth Button */}
        <button className="google-auth-btn" onClick={handleGoogleSignIn} disabled={loading}>
          <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          {t('continueWithGoogle')}
        </button>

        <div className="auth-divider">
          <span>{t('orWithEmail')}</span>
        </div>

        {/* Error / Success Alerts */}
        {errorMsg && (
          <div className="auth-alert auth-alert--error" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <AlertTriangle size={16} /> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="auth-alert auth-alert--success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={16} /> {successMsg}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'register' && (
            <>
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
            </>
          )}

          <div className="auth-form__group">
            <label>{t('emailLabel')} *</label>
            <input
              type="email"
              placeholder={t('emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-form__group">
            <label>{t('passwordLabel')} *</label>
            <input
              type="password"
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading
              ? (language === 'hi' ? 'कृपया प्रतीक्षा करें...' : 'Processing...')
              : (mode === 'register' ? t('registerSubmitBtn') : t('loginSubmitBtn'))}
          </button>
        </form>

        <div className="auth-modal__footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center' }}>
          {mode === 'login' ? (
            <button className="auth-switch-link" onClick={() => { setMode('register'); setErrorMsg(''); }}>
              {t('dontHaveAccount')}
            </button>
          ) : (
            <button className="auth-switch-link" onClick={() => { setMode('login'); setErrorMsg(''); }}>
              {t('alreadyHaveAccount')}
            </button>
          )}
          <button
            type="button"
            className="auth-guest-btn"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            {language === 'hi' ? 'अतिथि के रूप में जारी रखें (Guest Mode) →' : 'Continue as Guest →'}
          </button>
        </div>
      </div>
    </div>
  );
}
