import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  CloudRain,
  Copy,
  Droplets,
  LoaderCircle,
  MapPin,
  RefreshCw,
  Share2,
  Sparkles,
  Sprout,
  Sun,
  Thermometer,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { getCurrentWeather, getForecast } from '../services/weatherService.js';
import { getNasaPowerData } from '../services/apiClients.js';

const CROPS = [
  { id: 'Rice', en: 'Rice (Paddy)' },
  { id: 'Wheat', en: 'Wheat' },
  { id: 'Maize', en: 'Maize (Corn)' },
  { id: 'Cotton', en: 'Cotton' },
  { id: 'Soybean', en: 'Soybean' },
  { id: 'Mustard', en: 'Mustard' },
  { id: 'Sugarcane', en: 'Sugarcane' },
  { id: 'Potato', en: 'Potato' },
  { id: 'Tomato', en: 'Tomato' },
  { id: 'Onion', en: 'Onion' },
  { id: 'Pulses', en: 'Pulses (Lentils / Dal)' },
  { id: 'Vegetables', en: 'Vegetables (General)' },
  { id: 'Other', en: 'Other Crop' },
];

const STAGES = [
  { id: 'Land preparation', en: 'Land Preparation' },
  { id: 'Sowing / transplanting', en: 'Sowing / Transplanting' },
  { id: 'Vegetative growth', en: 'Vegetative Growth' },
  { id: 'Flowering', en: 'Flowering Stage' },
  { id: 'Grain / fruit development', en: 'Grain / Fruit Development' },
  { id: 'Harvest', en: 'Harvest Stage' },
];

const ADVISORY_TYPES = [
  { id: 'All-Round Advisory', en: 'All-Round Advisory (General)', desc: 'General agronomy, balanced irrigation, nutrition, and pest vigilance' },
  { id: 'Irrigation & Moisture', en: 'Irrigation & Water Management', desc: 'Irrigation scheduling, soil moisture retention, drainage, and rain forecast usage' },
  { id: 'Pest & Disease Control', en: 'Pest & Disease Protection', desc: 'Pest monitoring, fungal/bacterial threat identification, organic remedies, and chemical spray guidance' },
  { id: 'Fertilizer & Nutrition', en: 'Fertilizer & Soil Nutrition', desc: 'Nutrient application, NPK dosage, micronutrient deficiency correction, and soil health' },
  { id: 'Weather Risk & Spraying', en: 'Weather Risk & Spray Window', desc: 'Extreme heat/cold/rain risks, wind speed safety, and optimal spray timing' },
  { id: 'Harvest & Storage', en: 'Harvest & Post-Harvest Storage', desc: 'Maturity indicators, optimal harvest window, moisture drying, and storage pest prevention' },
];

const REPORT_LANGUAGES = [
  { id: 'en', name: 'English', speechLang: 'en-US' },
  { id: 'hi', name: 'Hindi (हिंदी)', speechLang: 'hi-IN' },
  { id: 'pa', name: 'Punjabi (ਪੰਜਾਬੀ)', speechLang: 'pa-IN' },
  { id: 'mr', name: 'Marathi (मराठी)', speechLang: 'mr-IN' },
  { id: 'gu', name: 'Gujarati (ગુજરાતી)', speechLang: 'gu-IN' },
  { id: 'bn', name: 'Bengali (বাংলা)', speechLang: 'bn-IN' },
  { id: 'te', name: 'Telugu (తెలుగు)', speechLang: 'te-IN' },
];

const dailyValues = (record) => Object.entries(record || {})
  .map(([date, value]) => ({ date, value: Number(value) }))
  .filter(({ date, value }) => /^\d{8}$/.test(date) && Number.isFinite(value) && value >= 0 && value < 9000)
  .sort((a, b) => a.date.localeCompare(b.date));

const formatNumber = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';

function makeGuidance({ crop, stage, advisory, weather, forecast, rain7d }) {
  const actions = [];
  const nextThreeDaysRain = forecast?.slice(0, 3).reduce((sum, day) => sum + (Number(day.precipitation) || 0), 0) || 0;
  const hot = Number(weather?.temp) >= 35;
  const humid = Number(weather?.humidity) >= 80;

  if (nextThreeDaysRain >= 20) {
    actions.push({
      type: 'watch',
      title: 'Rain likely in next 3 days',
      text: `The forecast totals about ${Math.round(nextThreeDaysRain)} mm over the next three days. Ensure field drainage channels are clear and postpone chemical spraying or irrigation.`
    });
  } else if (nextThreeDaysRain < 3 && rain7d != null && rain7d < 8) {
    actions.push({
      type: 'action',
      title: 'Check soil moisture',
      text: 'Recent rainfall and near-term forecast are low. Check the root-zone soil before deciding whether to irrigate.'
    });
  }

  if (hot) {
    actions.push({
      type: 'watch',
      title: 'Heat stress possible',
      text: `It is ${Math.round(weather.temp)}°C now. Shift field work and foliar applications to early morning or late evening to protect crops.`
    });
  }

  if (humid || nextThreeDaysRain >= 10) {
    actions.push({
      type: 'watch',
      title: 'High fungal / pest disease risk',
      text: 'High humidity or upcoming wet conditions elevate fungal pathogen and pest risks. Inspect undersides of leaves regularly.'
    });
  }

  const stageAdvice = {
    'Land preparation': `For ${crop.toLowerCase()}, prepare a level field and check soil moisture before working the land.`,
    'Sowing / transplanting': `For ${crop.toLowerCase()}, use locally recommended seed and spacing; avoid transplanting or sowing just ahead of heavy rain.`,
    'Vegetative growth': `For ${crop.toLowerCase()}, check soil moisture and weeds regularly; split nutrients according to local soil-test advice.`,
    'Flowering': `During ${crop.toLowerCase()} flowering, avoid moisture stress and schedule field operations around rain and strong winds.`,
    'Grain / fruit development': `As ${crop.toLowerCase()} develops, keep monitoring moisture, pests, and lodging risk; adjust irrigation to field conditions.`,
    'Harvest': `For ${crop.toLowerCase()} harvest, use a dry weather window where possible and dry produce properly before storage.`,
  }[stage] || `For ${crop.toLowerCase()}, inspect field regularly and adjust operations to local weather.`;

  actions.unshift({
    type: 'good',
    title: `${stage} · ${crop}`,
    text: stageAdvice
  });

  if (advisory && advisory !== 'All-Round Advisory') {
    actions.push({
      type: 'good',
      title: `Advisory Focus: ${advisory}`,
      text: `Focus area is set to ${advisory}. Click "Generate Crop Advisory Report" below for an in-depth scientific action plan.`
    });
  }

  if (!actions.some((item) => item.type === 'watch' || item.type === 'action')) {
    actions.push({
      type: 'good',
      title: 'Conditions look manageable',
      text: 'No strong heat or heavy-rain signal is showing in the available readings. Continue checking field and soil conditions.'
    });
  }

  return actions;
}

export default function AgricultureAdvisory({ location, onBack }) {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);

  const [crop, setCrop] = useState('Rice');
  const [stage, setStage] = useState('Vegetative growth');
  const [advisoryFocus, setAdvisoryFocus] = useState('All-Round Advisory');
  const [reportLang, setReportLang] = useState('en');
  const [farmerNotes, setFarmerNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [observations, setObservations] = useState(null);

  // AI Generated Report State
  const [generatedReport, setGeneratedReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const placeName = location?.name || location?.city || 'Durg';

  const load = useCallback(async () => {
    if (!hasCoordinates) {
      setObservations(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const results = await Promise.allSettled([
        getCurrentWeather(lat, lon),
        getForecast(lat, lon),
        getNasaPowerData(lat, lon),
      ]);
      const weather = results[0].status === 'fulfilled' ? results[0].value : null;
      const forecast = results[1].status === 'fulfilled' ? results[1].value : null;
      const nasa = results[2].status === 'fulfilled' ? results[2].value : null;
      const rainfallValues = dailyValues(nasa?.precipitation);
      const solarValues = dailyValues(nasa?.solarRadiation);
      const result = {
        weather,
        forecast,
        nasaAvailable: Boolean(nasa && !nasa.error && (rainfallValues.length || solarValues.length)),
        rain7d: rainfallValues.length ? rainfallValues.slice(-7).reduce((sum, item) => sum + item.value, 0) : null,
        solar: solarValues.length ? solarValues.slice(-7).reduce((sum, item) => sum + item.value, 0) / solarValues.length : null,
        updatedAt: weather?.time || new Date().toISOString(),
      };
      if (!weather && !forecast && !result.nasaAvailable) {
        setObservations(null);
        setError('Live weather and NASA POWER observations could not be loaded. Check your connection and try again.');
      } else {
        setObservations(result);
        if (!result.nasaAvailable) {
          setError('NASA POWER data is unavailable right now. The advisory uses live weather and forecast only.');
        }
      }
    } catch (e) {
      setError('Live weather data could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [hasCoordinates, lat, lon]);

  useEffect(() => {
    load();
  }, [load]);

  const guidance = useMemo(() => {
    if (!observations) return [];
    return makeGuidance({
      crop,
      stage,
      advisory: advisoryFocus,
      weather: observations.weather,
      forecast: observations.forecast,
      rain7d: observations.rain7d,
    });
  }, [crop, stage, advisoryFocus, observations]);

  const nextSevenDayRain = observations?.forecast?.reduce((sum, day) => sum + (Number(day.precipitation) || 0), 0);

  // Generate Full Farm Advisory Report based on Farmer's Inputs
  const handleGenerateReport = async () => {
    setReportLoading(true);
    setReportError('');
    try {
      const currentTemp = observations?.weather?.temp || 26;
      const currentHum = observations?.weather?.humidity || 75;
      const pastRain = observations?.rain7d != null ? observations.rain7d.toFixed(1) : '2.3';
      const forecastRain = nextSevenDayRain != null ? nextSevenDayRain.toFixed(1) : '0.0';
      const solarRad = observations?.solar != null ? observations.solar.toFixed(1) : '21.5';

      const selectedAdvObj = ADVISORY_TYPES.find(a => a.id === advisoryFocus) || ADVISORY_TYPES[0];
      const selectedLangObj = REPORT_LANGUAGES.find(l => l.id === reportLang) || REPORT_LANGUAGES[0];

      const prompt = `You are a Senior Chief Agricultural Scientist and Agromet Specialist at ICAR and IMD (India Meteorological Department).
Provide an official, comprehensive, scientific, yet easy-to-understand Field Advisory Report for an Indian farmer.

FARM DETAILS:
- Location: ${placeName} (Coordinates: ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)
- Selected Crop: ${crop}
- Growth Stage: ${stage}
- Advisory Focus Area: ${selectedAdvObj.en} (${selectedAdvObj.desc})
- Farmer's Specific Field Condition / Question: ${farmerNotes.trim() ? `"${farmerNotes.trim()}"` : `Focus primarily on ${selectedAdvObj.en}`}
- Preferred Output Language: ${selectedLangObj.name}

LIVE WEATHER OBSERVATIONS:
- Temperature: ${currentTemp}°C
- Relative Humidity: ${currentHum}%
- Weather Condition: ${observations?.weather?.description || 'Clear'}
- 7-Day Past Rain (NASA POWER): ${pastRain} mm
- 7-Day Forecast Rain: ${forecastRain} mm
- Solar Radiation: ${solarRad} kWh/m²/day

REPORT STRUCTURE REQUIRED:
1. 🌾 Field Condition Summary: 1-2 practical sentences assessing the ${crop} (${stage}) under these weather conditions.
2. 🎯 Focused Advisory (${selectedAdvObj.en}): Specific, actionable guidance addressing ${selectedAdvObj.desc}.
3. 💧 Irrigation Decision: Definite instruction considering root-zone needs and the ${forecastRain} mm forecast rain.
4. 🐛 Pest & Disease Protection: Real disease/pest threat for ${crop} at ${currentHum}% humidity, plus immediate organic (Neem, bio-agent) & recommended chemical treatment.
5. 🧪 Fertilizer & Spray Window: Safe hours for spraying, nutrient dose, and wind/rain safety.
6. 📅 3-Day Action Checklist: 3 clear actionable bullet points for the farmer.

CRITICAL LANGUAGE RULE:
- WRITE THE ENTIRE REPORT 100% IN ${selectedLangObj.name.toUpperCase()}. If Hindi (हिंदी) or another Indian language, write fully in native script (देवनागरी, etc.). If English, write in clear, professional English. Keep it respectful, practical, and easy for a farmer to understand.
Length: Around 180 to 240 words. Actionable and grounded in the data.`;

      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3 }
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.text) {
        setGeneratedReport(data.text);
      } else {
        throw new Error('No advisory text generated.');
      }
    } catch (err) {
      console.warn('Report generation failed:', err);
      setReportError('Could not generate advisory report. Please try again.');
    } finally {
      setReportLoading(false);
    }
  };

  // Audio Readout (SpeechSynthesis)
  const handleToggleSpeak = () => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const textToRead = generatedReport || guidance.map(g => `${g.title}. ${g.text}`).join(' ');
    const utterance = new SpeechSynthesisUtterance(textToRead);
    const selectedLangObj = REPORT_LANGUAGES.find(l => l.id === reportLang) || REPORT_LANGUAGES[0];
    utterance.lang = generatedReport ? selectedLangObj.speechLang : 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // WhatsApp Share
  const handleWhatsAppShare = () => {
    const isReportHi = reportLang === 'hi';
    const title = isReportHi ? `🌾 *कृषि परामर्श रिपोर्ट — ${placeName}*` : `🌾 *Crop Advisory Report — ${placeName}*`;
    const cropText = isReportHi
      ? `🌱 फसल: ${crop} (${stage}) | परामर्श: ${advisoryFocus}`
      : `🌱 Crop: ${crop} (${stage}) | Focus: ${advisoryFocus}`;
    const content = generatedReport || guidance.map(g => `• *${g.title}*: ${g.text}`).join('\n');
    const footer = isReportHi ? '📲 WeatherGPT AI द्वारा संचालित' : '📲 Powered by WeatherGPT AI';
    const msg = `${title}\n${cropText}\n\n${content}\n\n${footer}`;
    window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <main className="page-content agri-page">
      <header className="agri-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onBack && (
            <button
              className="agri-back-btn"
              onClick={onBack}
              title="Back"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--surface-card, rgba(255, 255, 255, 0.08))',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.2s',
                flexShrink: 0
              }}
            >
              <ArrowLeft size={18} />
            </button>
          )}
          <div>
            <span className="agri-eyebrow">
              WEATHER-AWARE FARMING
            </span>
            <h2>Agriculture Advisory</h2>
            <p>
              Practical crop guidance shaped by current local conditions and satellite data.
            </p>
          </div>
        </div>

        <div className="agri-header-right">
          {hasCoordinates && (
            <span className="agri-place">
              <MapPin size={15} />
              {placeName}
            </span>
          )}
          <button
            className="agri-refresh"
            onClick={load}
            disabled={loading || !hasCoordinates}
            aria-label="Refresh agricultural weather data"
          >
            <RefreshCw size={16} className={loading ? 'agri-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </header>

      {!hasCoordinates ? (
        <section className="agri-empty">
          <MapPin size={25} />
          <h3>Waiting for your location</h3>
          <p>Local weather and crop guidance will appear when your location is available.</p>
        </section>
      ) : loading && !observations ? (
        <section className="agri-empty">
          <LoaderCircle size={26} className="agri-spin" />
          <h3>Loading farm conditions</h3>
          <p>Fetching live weather, forecast, and NASA POWER observations for {placeName}.</p>
        </section>
      ) : error && !observations ? (
        <section className="agri-empty agri-empty--error">
          <AlertTriangle size={25} />
          <h3>Advisory data unavailable</h3>
          <p>{error}</p>
          <button onClick={load}>Try again</button>
        </section>
      ) : observations && (
        <>
          <section className="agri-condition-banner">
            <div className="agri-condition-icon">
              {observations.weather?.icon || '☀️'}
            </div>
            <div className="agri-condition-main">
              <span>Current conditions · {placeName}</span>
              <strong>{observations.weather?.description || 'Clear sky'}</strong>
              <small>
                Updated{' '}
                {new Date(observations.updatedAt).toLocaleString('en-US', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </small>
            </div>
            <div className="agri-condition-temp">
              {observations.weather ? `${observations.weather.temp}°` : '—'}
              <small>C</small>
            </div>
          </section>

          <section className="agri-metrics" aria-label="Local growing conditions">
            <article className="agri-metric">
              <span className="agri-metric-icon agri-metric-icon--sun">
                <Sun size={17} />
              </span>
              <div>
                <small>Solar radiation · NASA POWER</small>
                <strong>
                  {observations.solar == null ? '—' : `${formatNumber(observations.solar)} kWh/m²/day`}
                </strong>
                <span>7-day daily average</span>
              </div>
            </article>

            <article className="agri-metric">
              <span className="agri-metric-icon agri-metric-icon--rain">
                <Droplets size={17} />
              </span>
              <div>
                <small>Recent rainfall · NASA POWER</small>
                <strong>
                  {observations.rain7d == null ? '—' : `${formatNumber(observations.rain7d)} mm`}
                </strong>
                <span>Last 7 available days</span>
              </div>
            </article>

            <article className="agri-metric">
              <span className="agri-metric-icon agri-metric-icon--temp">
                <Thermometer size={17} />
              </span>
              <div>
                <small>Temperature &amp; humidity</small>
                <strong>
                  {observations.weather
                    ? `${observations.weather.temp}°C · ${observations.weather.humidity}%`
                    : 'Unavailable'}
                </strong>
                <span>Current local weather</span>
              </div>
            </article>

            <article className="agri-metric">
              <span className="agri-metric-icon agri-metric-icon--forecast">
                <CloudRain size={17} />
              </span>
              <div>
                <small>Forecast rainfall</small>
                <strong>
                  {Number.isFinite(nextSevenDayRain) ? `${formatNumber(nextSevenDayRain)} mm` : 'Unavailable'}
                </strong>
                <span>Next 7 forecast days</span>
              </div>
            </article>
          </section>

          <section className="agri-advisory-layout">
            {/* YOUR CROP ADVISORY CARD */}
            <div className="agri-advisory-card">
              <div className="agri-card-heading">
                <span className="agri-card-heading-icon">
                  <Sprout size={18} />
                </span>
                <div style={{ flex: 1 }}>
                  <h3>Your Crop Advisory</h3>
                  <p>Personalize the guidance for your field and generate an AI agromet report</p>
                </div>
              </div>

              {/* CROP, STAGE, ADVISORY & REPORT LANGUAGE SELECTORS */}
              <div className="agri-select-grid">
                <label>
                  <span>Crop</span>
                  <select value={crop} onChange={(event) => setCrop(event.target.value)}>
                    {CROPS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.en}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Growth Stage</span>
                  <select value={stage} onChange={(event) => setStage(event.target.value)}>
                    {STAGES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.en}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Advisory</span>
                  <select value={advisoryFocus} onChange={(event) => setAdvisoryFocus(event.target.value)}>
                    {ADVISORY_TYPES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.en}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span>Report Language</span>
                  <select value={reportLang} onChange={(event) => setReportLang(event.target.value)}>
                    {REPORT_LANGUAGES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* FARMER INPUT / OBSERVATION FIELD */}
              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  Field Situation, Symptoms, or Question (Optional):
                </label>
                <textarea
                  value={farmerNotes}
                  onChange={(e) => setFarmerNotes(e.target.value)}
                  placeholder="e.g. Yellow patches on leaves, should I irrigate this week, recommended pesticide dosage..."
                  rows={2}
                  style={{
                    width: '100%',
                    background: 'var(--bg-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    fontFamily: 'inherit',
                    resize: 'none',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />

                {/* Quick suggestion tags */}
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                  {[
                    '💧 When to irrigate?',
                    '🐛 Pest / fungus control',
                    '🌿 Fertilizer dose & nutrition',
                    '🌦️ Weather risk & spray safety',
                    '🌾 Harvest timing',
                  ].map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFarmerNotes(tag)}
                      style={{
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '12px',
                        padding: '4px 10px',
                        color: 'var(--text-secondary)',
                        fontSize: '11px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* GENERATE ADVISORY REPORT BUTTON */}
              <div style={{ marginBottom: '16px' }}>
                <button
                  type="button"
                  onClick={handleGenerateReport}
                  disabled={reportLoading}
                  style={{
                    width: '100%',
                    padding: '11px 16px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: reportLoading ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 15px rgba(16, 185, 129, 0.3)',
                    transition: 'all 0.2s'
                  }}
                >
                  <Sparkles size={16} className={reportLoading ? 'agri-spin' : ''} />
                  <span>
                    {reportLoading
                      ? 'Analyzing weather & generating report...'
                      : '🌾 Generate Crop Advisory Report'}
                  </span>
                </button>
              </div>

              {/* GENERATED ADVISORY REPORT VIEW */}
              {reportLoading ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.05)', borderRadius: '12px', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                  <LoaderCircle size={26} className="agri-spin" style={{ margin: '0 auto 10px', color: '#10b981' }} />
                  <p style={{ margin: 0, fontSize: '13px', color: '#10b981', fontWeight: 600 }}>
                    Analyzing weather &amp; agromet conditions for {crop}...
                  </p>
                </div>
              ) : reportError ? (
                <div style={{ padding: '12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                  {reportError}
                </div>
              ) : generatedReport ? (
                <div
                  className="agri-report-box"
                  style={{
                    background: 'var(--surface-card)',
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    position: 'relative'
                  }}
                >
                  {/* Report Header Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📋</span> Crop Advisory Report — {crop}
                      </strong>
                      <small style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
                        {placeName} · {stage} · Focus: {advisoryFocus} · Language: {REPORT_LANGUAGES.find(l => l.id === reportLang)?.name || 'English'}
                      </small>
                    </div>

                    {/* Report Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Audio */}
                      <button
                        type="button"
                        onClick={handleToggleSpeak}
                        title={isSpeaking ? 'Stop audio' : 'Listen to report'}
                        style={{
                          background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'var(--bg-primary)',
                          border: isSpeaking ? '1px solid #ef4444' : '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          color: isSpeaking ? '#ef4444' : 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '11px',
                          fontWeight: 500
                        }}
                      >
                        {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        <span>{isSpeaking ? 'Stop' : 'Listen'}</span>
                      </button>

                      {/* Copy */}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedReport);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        title="Copy report"
                        style={{
                          background: 'var(--bg-primary)',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          color: copied ? '#10b981' : 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '11px',
                          fontWeight: 500
                        }}
                      >
                        {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                        <span>{copied ? 'Copied' : 'Copy'}</span>
                      </button>

                      {/* WhatsApp Share */}
                      <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        title="Share on WhatsApp"
                        style={{
                          background: 'rgba(34, 197, 94, 0.15)',
                          border: '1px solid rgba(34, 197, 94, 0.35)',
                          borderRadius: '6px',
                          padding: '5px 9px',
                          color: '#16a34a',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                      >
                        <Share2 size={13} />
                        <span>WhatsApp</span>
                      </button>
                    </div>
                  </div>

                  {/* Report Content */}
                  <div
                    style={{
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      lineHeight: '1.75',
                      whiteSpace: 'pre-line'
                    }}
                  >
                    {generatedReport}
                  </div>
                </div>
              ) : null}

              {/* DEFAULT GUIDANCE CARDS (Shown below report or when report not yet generated) */}
              <div className="agri-guidance-list">
                {guidance.map((item, index) => (
                  <article
                    className={`agri-guidance agri-guidance--${item.type}`}
                    key={`${item.title}-${index}`}
                  >
                    <span>
                      {item.type === 'watch' || item.type === 'action' ? (
                        <AlertTriangle size={16} />
                      ) : (
                        <Sprout size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <p>{item.text}</p>
                    </div>
                  </article>
                ))}
              </div>

              <p className="agri-safety-note">
                Guidance is weather-informed and general. Check field conditions and consult local agricultural extension officers for crop-specific decisions.
              </p>
            </div>
          </section>

          <footer className="agri-data-note">
            Weather &amp; forecast: Open-Meteo · Solar radiation and recent rainfall: NASA POWER (daily point data)
            {!observations.nasaAvailable && <span> · NASA POWER is temporarily unavailable</span>}
          </footer>
          {error && (
            <div className="agri-inline-note">
              <AlertTriangle size={14} />
              {error}
            </div>
          )}
        </>
      )}
    </main>
  );
}
