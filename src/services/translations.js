/* WeatherGPT — Internationalization & Translation Dictionary
 * Full app translation engine for English & Hindi (हिंदी)
 */

export const TRANSLATIONS = {
  en: {
    // Header & User Bar
    appName: "WeatherGPT",
    appSubtitle: "AI Weather & Disaster Advisory System",
    welcome: "Welcome",
    loginRegister: "Sign In / Register",
    logout: "Logout",
    editProfile: "Edit Profile",
    apiStatus: "API Status & Settings",
    languageLabel: "Language",
    languageName: "English",

    // User Profile Labels & Occupations
    nameLabel: "Full Name",
    emailLabel: "Email Address",
    passwordLabel: "Password",
    occupationLabel: "Occupation",
    ageLabel: "Age (Years)",
    selectOccupation: "Select occupation...",
    selectLanguage: "Select language...",

    occupations: {
      student: "Student / Learner",
      farmer: "Farmer / Agricultural Worker",
      tech: "Software / Tech Professional",
      business: "Business / Entrepreneur",
      researcher: "Weather Researcher / Meteorologist",
      govt: "Government / Public Servant",
      other: "Other",
    },

    languages: {
      en: "English",
      hi: "Hindi (हिंदी)",
    },

    // Instrument Strip
    detectingLocation: "Detecting location...",
    syncingFeeds: "Syncing IMD & Open-Meteo feeds...",
    feelsLike: "Feels",
    humidity: "Humidity",
    wind: "Wind",
    pressure: "Pressure",
    unknownLocation: "Unknown Location",

    // Empty State
    heroTitle: "WeatherGPT",
    heroSubtitle: "Multilingual AI Weather & Hazard Platform for IMD, NASA POWER, GDACS, USGS & Bhashini Voice.",
    sampleQuestionsHeader: "Try asking one of these questions:",
    sampleQuestions: [
      { text: "What's the current weather in Ranchi?" },
      { text: "Show me the 7-day IMD forecast" },
      { text: "Will it rain today?" },
      { text: "Recent earthquakes near India?" },
      { text: "NASA POWER crop weather advisory" },
      { text: "Check active disaster alerts" },
    ],

    // Input Bar & Voice
    inputPlaceholder: "Ask weather, forecasts, or travel in English, Hinglish, or Hindi...",
    listeningVoice: "Bhashini Voice ASR Listening...",
    processingVoice: "Processing Speech...",
    voiceHint: "Speak in Hindi, English or regional languages...",

    // Modals
    loginModalTitle: "Sign In to WeatherGPT",
    registerModalTitle: "Create WeatherGPT Account",
    completeProfileTitle: "Complete Your WeatherGPT Profile",
    continueWithGoogle: "Continue with Google",
    orWithEmail: "or continue with email",
    alreadyHaveAccount: "Already have an account? Sign In",
    dontHaveAccount: "Don't have an account? Register",
    saveProfileBtn: "Save Profile",
    registerSubmitBtn: "Register & Start",
    loginSubmitBtn: "Sign In",
    agePlaceholder: "Enter your age (e.g. 24)",
    namePlaceholder: "Enter your full name",
    emailPlaceholder: "name@example.com",
    passwordPlaceholder: "Enter password (min 6 chars)",

    // Settings
    settingsTitle: "API Integration Status",
    configuredServices: "Configured API Services (.env)",
    preferencesLabel: "Preferences & Language",
    darkModeToggle: "Dark Mode (Default)",
    lightModeToggle: "Light Mode",
    activeLabel: "Active",

    // Auth Messages
    loginSuccess: "Successfully logged in!",
    registerSuccess: "Registration successful! Welcome to WeatherGPT.",
    logoutSuccess: "Logged out successfully.",
    authError: "Authentication failed. Please check your credentials.",
    profileUpdated: "Profile updated successfully!",
    fillAllFields: "Please fill in all required registration fields.",

    // Profile View
    viewProfile: "My Profile",
    profileTitle: "User Profile & Personalization",
    accountType: "Account Status",
    verifiedAccount: "Supabase Cloud Authenticated",
    personalizationHeading: "AI Engine Personalization Active",
    occupationAdvisoryInfo: "WeatherGPT AI automatically adapts its conversational tone, language, and advice (crop care, school/college travel, outdoor work) specifically for your profile.",
  },

  hi: {
    // Header & User Bar
    appName: "वेदर-जीपीटी (WeatherGPT)",
    appSubtitle: "एआई मौसम एवं आपदा परामर्श प्रणाली",
    welcome: "स्वागत है",
    loginRegister: "साइन इन / पंजीकरण करें",
    logout: "लॉगआउट",
    editProfile: "प्रोफ़ाइल संपादित करें",
    apiStatus: "एपीआई स्थिति व सेटिंग्स",
    languageLabel: "भाषा",
    languageName: "हिंदी",

    // User Profile Labels & Occupations
    nameLabel: "पूरा नाम",
    emailLabel: "ईमेल पता",
    passwordLabel: "पासवर्ड",
    occupationLabel: "व्यवसाय / पेशा",
    ageLabel: "आयु (वर्ष)",
    selectOccupation: "अपना व्यवसाय चुनें...",
    selectLanguage: "अपनी भाषा चुनें...",

    occupations: {
      student: "छात्र / विद्यार्थी",
      farmer: "किसान / कृषि कर्मी",
      tech: "सॉफ्टवेयर / तकनीक पेशेवर",
      business: "व्यवसाय / उद्यमी",
      researcher: "मौसम वैज्ञानिक / शोधकर्ता",
      govt: "सरकारी सेवक / प्रशासनिक अधिकारी",
      other: "अन्य",
    },

    languages: {
      en: "English (अंग्रेज़ी)",
      hi: "हिंदी (Hindi)",
    },

    // Instrument Strip
    detectingLocation: "स्थान खोजा जा रहा है...",
    syncingFeeds: "आईएमडी एवं ओपन-मेटियो डेटा लोड हो रहा है...",
    feelsLike: "महसूस हो रहा है",
    humidity: "नमी",
    wind: "हवा",
    pressure: "दबाव",
    unknownLocation: "अज्ञात स्थान",

    // Empty State
    heroTitle: "वेदर-जीपीटी (WeatherGPT)",
    heroSubtitle: "आईएमडी, नासा पावर, जीडीएसीएस, यूएसजीएस एवं भाषिणी वॉइस हेतु बहुभाषी एआई मौसम एवं आपदा मंच।",
    sampleQuestionsHeader: "इनमें से कोई प्रश्न पूछें:",
    sampleQuestions: [
      { text: "रांची में वर्तमान मौसम कैसा है?" },
      { text: "मुझे 7-दिवसीय IMD पूर्वानुमान दिखाएं" },
      { text: "क्या आज बारिश होगी?" },
      { text: "भारत के पास हाल में आए भूकंप की जानकारी दें" },
      { text: "नासा पावर किसान फसल मौसम परामर्श" },
      { text: "सक्रिय आपदा एवं मौसम चेतावनी जांचें" },
    ],

    // Input Bar & Voice
    inputPlaceholder: "हिंदी, हिंग्लिश या अंग्रेजी में मौसम, फसल या यात्रा के बारे में पूछें...",
    listeningVoice: "भाषिणी वॉइस एएसआर सुन रहा है...",
    processingVoice: "आपकी आवाज़ संसाधित की जा रही है...",
    voiceHint: "हिंदी, अंग्रेजी या अपनी क्षेत्रीय भाषा में बोलें...",

    // Modals
    loginModalTitle: "WeatherGPT में साइन इन करें",
    registerModalTitle: "WeatherGPT नया खाता बनाएं (पंजीकरण)",
    completeProfileTitle: "अपनी WeatherGPT प्रोफ़ाइल पूर्ण करें",
    continueWithGoogle: "गूगल (Google) के साथ साइन इन करें",
    orWithEmail: "या ईमेल के साथ जारी रखें",
    alreadyHaveAccount: "पहले से खाता है? साइन इन करें",
    dontHaveAccount: "खाता नहीं है? पंजीकरण (Register) करें",
    saveProfileBtn: "प्रोफ़ाइल सहेजें",
    registerSubmitBtn: "पंजीकरण करें और शुरू करें",
    loginSubmitBtn: "साइन इन करें",
    agePlaceholder: "अपनी उम्र दर्ज करें (उदा. 25)",
    namePlaceholder: "अपना पूरा नाम दर्ज करें",
    emailPlaceholder: "naam@example.com",
    passwordPlaceholder: "पासवर्ड दर्ज करें (कम से कम 6 अक्षर)",

    // Settings
    settingsTitle: "एपीआई एकीकरण स्थिति",
    configuredServices: "कॉन्फ़िगर की गई एपीआई सेवाएं (.env)",
    preferencesLabel: "प्राथमिकताएं एवं भाषा",
    darkModeToggle: "डार्क मोड (डिफ़ॉल्ट)",
    lightModeToggle: "लाइट मोड",
    activeLabel: "सक्रिय",

    // Auth Messages
    loginSuccess: "सफलतापूर्वक लॉगिन हो गए!",
    registerSuccess: "पंजीकरण सफल रहा! WeatherGPT में आपका स्वागत है।",
    logoutSuccess: "सफलतापूर्वक लॉगआउट हो गए।",
    authError: "प्रमाणीकरण विफल रहा। कृपया अपनी जानकारी जांचें।",
    profileUpdated: "प्रोफ़ाइल सफलतापूर्वक अद्यतन की गई!",
    fillAllFields: "कृपया पंजीकरण के सभी आवश्यक फ़ील्ड भरें।",

    // Profile View
    viewProfile: "मेरी प्रोफ़ाइल",
    profileTitle: "उपयोगकर्ता प्रोफ़ाइल एवं निजीकरण",
    accountType: "खाता स्थिति",
    verifiedAccount: "सुपाबेस क्लाउड प्रमाणीकृत",
    personalizationHeading: "एआई इंजन निजीकरण सक्रिय",
    occupationAdvisoryInfo: "WeatherGPT एआई आपके चुने गए व्यवसाय और भाषा के आधार पर आपकी फसल सुरक्षा, यात्रा, पढ़ाई या आउटडोर सलाह को स्वचालित रूप से कस्टमाइज़ करता है।",
  }
};

export function getTranslation(key, lang = 'en') {
  const dictionary = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return dictionary[key] || TRANSLATIONS.en[key] || key;
}
