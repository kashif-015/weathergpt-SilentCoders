import { useState, useEffect } from 'react';
import { signInWithEmail, signUpWithEmail, signInWithGoogle, resendConfirmationEmail } from '../services/firebaseClient.js';
import { getTranslation } from '../services/translations.js';
import { CloudSun, AlertTriangle, CheckCircle2, X, MailCheck, RefreshCw, Briefcase } from 'lucide-react';
import weatherGPTLogo from '../assets/weatherGPT_logo.png';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, currentLang, setAppLanguage }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [occupation, setOccupation] = useState('');
  const [language, setLanguage] = useState(currentLang || 'en');
  const [age, setAge] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [verificationSentTo, setVerificationSentTo] = useState(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState('');
  const [showResendForLogin, setShowResendForLogin] = useState(false);
  const [googleStep, setGoogleStep] = useState('initial'); // 'initial' | 'choose_profession'
  const [googleProfession, setGoogleProfession] = useState('Farmer');

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  if (!isOpen) return null;

  const t = (key) => getTranslation(key, language);

  const handleLanguageSelect = (langCode) => {
    setLanguage(langCode);
    setAppLanguage(langCode);
  };

  const handleProceedWithGoogle = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('weathergpt_pending_oauth_occupation', googleProfession);
        localStorage.setItem('weathergpt_pending_oauth_language', language);
      }
      const result = await signInWithGoogle();
      if (result?.profile) {
        result.profile.occupation = googleProfession;
        onAuthSuccess(result.profile);
        onClose();
      }
    } catch (err) {
      setErrorMsg(err.message || t('authError'));
      setLoading(false);
    }
  };

  const handleResendEmail = async (targetEmail) => {
    const toEmail = targetEmail || verificationSentTo || email.trim();
    if (!toEmail) return;
    try {
      setResendLoading(true);
      setErrorMsg('');
      setResendSuccess('');
      await resendConfirmationEmail(toEmail);
      setResendSuccess(
        language === 'hi'
          ? 'सत्यापन लिंक फिर से भेज दिया गया है! कृपया इनबॉक्स या स्पैम फ़ोल्डर जांचें।'
          : 'Verification link resent! Please check your inbox and Spam folder.'
      );
      setResendCooldown(60);
    } catch (err) {
      setErrorMsg(err.message || 'Failed to resend confirmation email.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setResendSuccess('');
    setShowResendForLogin(false);

    if (mode === 'register') {
      if (!name.trim() || !email.trim() || !password.trim() || !age || !occupation) {
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

        setLoading(false);
        if (result.verificationRequired) {
          setVerificationSentTo(email.trim());
          setResendCooldown(60);
        } else {
          setSuccessMsg(language === 'hi' ? 'खाता सफलतापूर्वक बनाया गया!' : 'Account successfully created!');
          onAuthSuccess(result.profile);
          onClose();
        }
      } else {
        const result = await signInWithEmail({
          email: email.trim(),
          password: password.trim(),
          language,
        });

        setSuccessMsg(t('loginSuccess'));
        setLoading(false);
        onAuthSuccess(result.profile);
        onClose();
      }
    } catch (err) {
      setLoading(false);
      const msg = err.message || t('authError');
      setErrorMsg(msg);
      if (msg.includes('not verified') || msg.includes('सत्यापित नहीं')) {
        setShowResendForLogin(true);
      }
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

        {verificationSentTo ? (
          <div className="auth-verification-view" style={{ textAlign: 'center', padding: '12px 6px' }}>
            <div style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '2px solid rgba(56, 189, 248, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#38bdf8'
            }}>
              <MailCheck size={34} />
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px', color: '#fff' }}>
              {language === 'hi' ? 'पुष्टिकरण लिंक भेजा गया!' : 'Confirmation Link Sent!'}
            </h3>

            <p style={{ fontSize: '14px', color: 'rgba(255, 255, 255, 0.85)', marginBottom: '16px', lineHeight: 1.5 }}>
              {language === 'hi' ? (
                <>हमने आपके ईमेल <strong style={{ color: '#38bdf8' }}>{verificationSentTo}</strong> पर सत्यापन लिंक भेजा है।</>
              ) : (
                <>We have sent a confirmation link to <strong style={{ color: '#38bdf8' }}>{verificationSentTo}</strong>.</>
              )}
            </p>

            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              borderRadius: '10px',
              padding: '12px 14px',
              fontSize: '13px',
              color: '#fbbf24',
              textAlign: 'left',
              marginBottom: '20px',
              lineHeight: 1.5
            }}>
              <strong style={{ display: 'block', marginBottom: '4px' }}>
                📌 {language === 'hi' ? 'जरूरी निर्देश:' : 'Important Instructions:'}
              </strong>
              <div style={{ margin: '4px 0' }}>
                • {language === 'hi' ? 'कृपया अपना इनबॉक्स खोलें और लिंक पर क्लिक करें।' : 'Open your email and click the confirmation link.'}
              </div>
              <div style={{ margin: '4px 0' }}>
                • {language === 'hi' ? 'यदि इनबॉक्स में न दिखे, तो Spam / Junk फ़ोल्डर अवश्य जांचें!' : "If not in your Inbox, please check Spam / Junk / Promotions folder!"}
              </div>
            </div>

            {errorMsg && (
              <div className="auth-alert auth-alert--error" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}
            {resendSuccess && (
              <div className="auth-alert auth-alert--success" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                <CheckCircle2 size={16} /> {resendSuccess}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="auth-submit-btn"
                style={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                  cursor: resendCooldown > 0 || resendLoading ? 'not-allowed' : 'pointer'
                }}
                onClick={() => handleResendEmail(verificationSentTo)}
                disabled={resendLoading || resendCooldown > 0}
              >
                {resendLoading ? (
                  language === 'hi' ? 'भेजा जा रहा है...' : 'Sending...'
                ) : resendCooldown > 0 ? (
                  language === 'hi' ? `पुनः भेजें (${resendCooldown}s)` : `Resend Email (${resendCooldown}s)`
                ) : (
                  language === 'hi' ? 'ईमेल दोबारा भेजें (Resend)' : 'Resend Confirmation Email'
                )}
              </button>

              <button
                type="button"
                className="auth-submit-btn"
                onClick={() => {
                  setVerificationSentTo(null);
                  setMode('login');
                  setErrorMsg('');
                  setSuccessMsg(
                    language === 'hi'
                      ? 'पुष्टिकरण के बाद अपने ईमेल और पासवर्ड से साइन इन करें।'
                      : 'Please sign in with your email and password after clicking the email link.'
                  );
                }}
              >
                {language === 'hi' ? 'साइन इन करें (Sign In)' : 'Go to Sign In'}
              </button>
            </div>
          </div>
        ) : googleStep === 'choose_profession' ? (
          <div className="auth-google-profession-step" style={{ padding: '6px 0' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{
                width: 52,
                height: 52,
                borderRadius: '50%',
                background: 'rgba(56, 189, 248, 0.15)',
                border: '2px solid rgba(56, 189, 248, 0.4)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 10px',
                color: '#38bdf8'
              }}>
                <Briefcase size={26} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' }}>
                {language === 'hi' ? 'अपना व्यवसाय चुनें' : 'Choose Your Profession'}
              </h3>
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
                {language === 'hi'
                  ? 'Google से साइन इन करने से पहले अपना पेशा चुनें'
                  : 'Select your profession before continuing with Google'}
              </p>
            </div>

            {/* Profession Select Dropdown */}
            <div className="auth-form" style={{ marginBottom: '18px' }}>
              <div className="auth-form__group">
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  {language === 'hi' ? 'व्यवसाय चुनें' : 'Select Profession'}
                </label>
                <select
                  value={googleProfession}
                  onChange={(e) => setGoogleProfession(e.target.value)}
                >
                  <option value="Farmer">{language === 'hi' ? '🌾 किसान (कृषि परामर्श विशेष पहुंच)' : '🌾 Farmer / Agricultural Worker'}</option>
                  <option value="Student">{language === 'hi' ? '🎓 विद्यार्थी / छात्र' : '🎓 Student / Learner'}</option>
                  <option value="Software Tech">{language === 'hi' ? '💻 सॉफ्टवेयर / तकनीकी पेशेवर' : '💻 Software / Tech Professional'}</option>
                  <option value="Business">{language === 'hi' ? '💼 व्यापारी / उद्यमी' : '💼 Business / Entrepreneur'}</option>
                  <option value="Weather Researcher">{language === 'hi' ? '🔬 मौसम शोधकर्ता / वैज्ञानिक' : '🔬 Weather Researcher / Scientist'}</option>
                  <option value="Government Servant">{language === 'hi' ? '🏛️ सरकारी कर्मचारी' : '🏛️ Government / Public Servant'}</option>
                  <option value="Other">{language === 'hi' ? '🌐 अन्य' : '🌐 Other'}</option>
                </select>
              </div>
            </div>

            {errorMsg && (
              <div className="auth-alert auth-alert--error" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <AlertTriangle size={16} /> {errorMsg}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="auth-submit-btn"
                disabled={loading}
                onClick={handleProceedWithGoogle}
              >
                {loading ? (
                  language === 'hi' ? 'कृपया प्रतीक्षा करें...' : 'Connecting to Google...'
                ) : (
                  language === 'hi'
                    ? `Google से साइन इन करें (${googleProfession === 'Farmer' ? 'किसान' : googleProfession}) →`
                    : `Sign in with Google as ${googleProfession} →`
                )}
              </button>

              <button
                type="button"
                onClick={() => setGoogleStep('initial')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  padding: '6px'
                }}
              >
                ← {language === 'hi' ? 'वापस जाएं (Back)' : 'Back to Login Options'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Auth Tabs */}
            <div className="auth-modal__tabs">
              <button
                className={`auth-modal__tab ${mode === 'login' ? 'auth-modal__tab--active' : ''}`}
                onClick={() => { setMode('login'); setErrorMsg(''); setSuccessMsg(''); setShowResendForLogin(false); }}
              >
                {t('loginSubmitBtn')}
              </button>
              <button
                className={`auth-modal__tab ${mode === 'register' ? 'auth-modal__tab--active' : ''}`}
                onClick={() => { setMode('register'); setErrorMsg(''); setSuccessMsg(''); setShowResendForLogin(false); }}
              >
                {t('registerModalTitle').includes('पंजीकरण') ? 'पंजीकरण (Register)' : 'Register'}
              </button>
            </div>

            {/* Google Auth Button */}
            <button className="google-auth-btn" onClick={() => setGoogleStep('choose_profession')} disabled={loading}>
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
              <div className="auth-alert auth-alert--error" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} /> {errorMsg}
                </div>
                {showResendForLogin && (
                  <button
                    type="button"
                    onClick={() => handleResendEmail(email.trim())}
                    disabled={resendLoading || resendCooldown > 0}
                    style={{
                      background: 'rgba(255,255,255,0.15)',
                      border: '1px solid rgba(255,255,255,0.3)',
                      color: '#fff',
                      borderRadius: '6px',
                      padding: '4px 8px',
                      fontSize: '12px',
                      marginTop: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    {resendCooldown > 0 ? `Resend (${resendCooldown}s)` : 'Resend Confirmation Email'}
                  </button>
                )}
              </div>
            )}
            {resendSuccess && (
              <div className="auth-alert auth-alert--success" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCircle2 size={16} /> {resendSuccess}
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
                        <option value="" disabled>{language === 'hi' ? '-- व्यवसाय चुनें --' : '-- Select Occupation --'}</option>
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
          </>
        )}
      </div>
    </div>
  );
}
