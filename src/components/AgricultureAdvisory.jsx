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
  Wind
} from 'lucide-react';
import { getCurrentWeather, getForecast } from '../services/weatherService.js';
import { getNasaPowerData } from '../services/apiClients.js';

const CROPS = [
  { id: 'Rice', en: 'Rice (Paddy)', hi: 'धान (चावल)' },
  { id: 'Wheat', en: 'Wheat', hi: 'गेहूं' },
  { id: 'Maize', en: 'Maize (Corn)', hi: 'मक्का' },
  { id: 'Cotton', en: 'Cotton', hi: 'कपास' },
  { id: 'Soybean', en: 'Soybean', hi: 'सोयाबीन' },
  { id: 'Mustard', en: 'Mustard', hi: 'सरसों' },
  { id: 'Sugarcane', en: 'Sugarcane', hi: 'गन्ना' },
  { id: 'Potato', en: 'Potato', hi: 'आलू' },
  { id: 'Tomato', en: 'Tomato', hi: 'टमाटर' },
  { id: 'Onion', en: 'Onion', hi: 'प्याज' },
  { id: 'Pulses', en: 'Pulses (Lentils)', hi: 'दालें / दलहन' },
  { id: 'Vegetables', en: 'Vegetables', hi: 'हरी सब्जियां' },
  { id: 'Other', en: 'Other Crop', hi: 'अन्य फसल' },
];

const STAGES = [
  { id: 'Land preparation', en: 'Land preparation', hi: 'खेत की तैयारी' },
  { id: 'Sowing / transplanting', en: 'Sowing / transplanting', hi: 'बुवाई / रोपाई' },
  { id: 'Vegetative growth', en: 'Vegetative growth', hi: 'वानस्पतिक वृद्धि' },
  { id: 'Flowering', en: 'Flowering', hi: 'फूल आने की अवस्था' },
  { id: 'Grain / fruit development', en: 'Grain / fruit development', hi: 'दाना / फल भराव' },
  { id: 'Harvest', en: 'Harvest', hi: 'कटाई' },
];

const dailyValues = (record) => Object.entries(record || {})
  .map(([date, value]) => ({ date, value: Number(value) }))
  .filter(({ date, value }) => /^\d{8}$/.test(date) && Number.isFinite(value) && value >= 0 && value < 9000)
  .sort((a, b) => a.date.localeCompare(b.date));

const formatNumber = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';

function makeGuidance({ crop, stage, weather, forecast, rain7d, lang = 'en' }) {
  const isHi = lang === 'hi';
  const actions = [];
  const nextThreeDaysRain = forecast?.slice(0, 3).reduce((sum, day) => sum + (Number(day.precipitation) || 0), 0) || 0;
  const hot = Number(weather?.temp) >= 35;
  const humid = Number(weather?.humidity) >= 80;

  if (nextThreeDaysRain >= 20) {
    actions.push({
      type: 'watch',
      title: isHi ? 'निकट समय में वर्षा की संभावना' : 'Rain likely soon',
      text: isHi
        ? `आगामी तीन दिनों में लगभग ${Math.round(nextThreeDaysRain)} मिमी वर्षा का अनुमान है। खेतों में जल निकासी की व्यवस्था करें और वर्षा के बाद ही सिंचाई पर विचार करें।`
        : `The forecast totals about ${Math.round(nextThreeDaysRain)} mm over the next three days. Check field drainage and reassess irrigation after the rain.`
    });
  } else if (nextThreeDaysRain < 3 && rain7d != null && rain7d < 8) {
    actions.push({
      type: 'action',
      title: isHi ? 'मृदा में नमी की जांच करें' : 'Check soil moisture',
      text: isHi
        ? 'हाल की वर्षा और निकट अवधि का पूर्वानुमान दोनों कम हैं। सिंचाई का निर्णय लेने से पहले जड़ क्षेत्र की मिट्टी की नमी अवश्य जांचें।'
        : 'Recent rainfall and the near-term forecast are both low. Check the root-zone soil before deciding whether to irrigate.'
    });
  }

  if (hot) {
    actions.push({
      type: 'watch',
      title: isHi ? 'गर्मी का तनाव संभव' : 'Heat stress possible',
      text: isHi
        ? `वर्तमान तापमान ${Math.round(weather.temp)}°C है। दोपहर की कड़ी धूप में खेत कार्य से बचें और युवा पौधों की निगरानी करें।`
        : `It is ${Math.round(weather.temp)}°C now. Shift field work to cooler hours and monitor young plants for wilting.`
    });
  }
  if (humid || nextThreeDaysRain >= 10) {
    actions.push({
      type: 'watch',
      title: isHi ? 'फसल रोगों पर निगरानी रखें' : 'Monitor for crop disease',
      text: isHi
        ? 'उच्च आर्द्रता और गीली परिस्थितियों से फफूंद जनित रोगों का खतरा बढ़ जाता है। पत्तियों की जांच करें और उचित सुरक्षा उपाय अपनाएं।'
        : 'Humid or wet conditions can raise fungal disease pressure. Inspect leaves and follow local crop-protection guidance before spraying.'
    });
  }

  const stageAdvice = {
    'Land preparation': isHi
      ? `${crop} के लिए, खेत को समतल तैयार करें और जुताई से पहले मिट्टी की नमी अवश्य जांचें।`
      : `For ${crop.toLowerCase()}, prepare a level field and check soil moisture before working the land.`,
    'Sowing / transplanting': isHi
      ? `${crop} के लिए, अनुशंसित प्रमाणित बीज और सही दूरी का प्रयोग करें; भारी वर्षा के ठीक पहले बुवाई या रोपाई से बचें।`
      : `For ${crop.toLowerCase()}, use locally recommended seed and spacing; avoid transplanting or sowing just ahead of heavy rain.`,
    'Vegetative growth': isHi
      ? `${crop} के लिए, मिट्टी की नमी और खरपतवार की नियमित निगरानी करें; उर्वरकों को संतुलित मात्रा में दें।`
      : `For ${crop.toLowerCase()}, check soil moisture and weeds regularly; split nutrients according to local soil-test advice.`,
    'Flowering': isHi
      ? `${crop} में फूल आते समय, नमी की कमी न होने दें और तेज हवा व बारिश के समय छिड़काव से बचें।`
      : `During ${crop.toLowerCase()} flowering, avoid moisture stress and schedule field operations around rain and strong winds.`,
    'Grain / fruit development': isHi
      ? `${crop} के विकास के दौरान, नमी, कीट और फसल गिरने के जोखिम की निगरानी रखें; सिंचाई को तदनुसार समायोजित करें।`
      : `As ${crop.toLowerCase()} develops, keep monitoring moisture, pests, and lodging risk; adjust irrigation to field conditions.`,
    'Harvest': isHi
      ? `${crop} की कटाई के लिए, सूखे धूप वाले मौसम का उपयोग करें और भंडारण से पहले उपज को अच्छी तरह सुखाएं।`
      : `For ${crop.toLowerCase()} harvest, use a dry weather window where possible and dry produce properly before storage.`,
  }[stage] || (isHi ? `${crop} की नियमित निगरानी रखें और मौसम अनुसार कार्य करें।` : `For ${crop.toLowerCase()}, inspect field regularly and adjust operations to local weather.`);

  actions.unshift({
    type: 'good',
    title: `${stage} · ${crop}`,
    text: stageAdvice
  });

  if (!actions.some((item) => item.type === 'watch' || item.type === 'action')) {
    actions.push({
      type: 'good',
      title: isHi ? 'परिस्थितियां सामान्य और अनुकूल हैं' : 'Conditions look manageable',
      text: isHi
        ? 'वर्तमान आंकड़ों में किसी अत्यधिक गर्मी या मूसलाधार बारिश का संकेत नहीं है। खेत की स्थिति की नियमित जांच जारी रखें।'
        : 'No strong heat or heavy-rain signal is showing in the available readings. Continue checking field and soil conditions.'
    });
  }

  return actions;
}

export default function AgricultureAdvisory({ location, currentLang = 'en', onBack }) {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);

  const [crop, setCrop] = useState('Rice');
  const [stage, setStage] = useState('Vegetative growth');
  const [farmerNotes, setFarmerNotes] = useState('');
  const [advisoryLang, setAdvisoryLang] = useState(currentLang === 'hi' ? 'hi' : 'hi'); // Default Hindi for farmers
  const isHi = advisoryLang === 'hi';

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
      weather: observations.weather,
      forecast: observations.forecast,
      rain7d: observations.rain7d,
      lang: advisoryLang,
    });
  }, [crop, stage, observations, advisoryLang]);

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

      const prompt = `You are a Senior Chief Agricultural Scientist and Agromet Specialist at ICAR and IMD (India Meteorological Department).
Provide an official, comprehensive, scientific, yet easy-to-understand Field Advisory Report for an Indian farmer.

FARM DETAILS:
- Location: ${placeName} (Coordinates: ${lat.toFixed(2)}°N, ${lon.toFixed(2)}°E)
- Selected Crop: ${crop}
- Growth Stage: ${stage}
- Farmer's Specific Field Condition / Question: ${farmerNotes.trim() ? `"${farmerNotes.trim()}"` : 'General agronomy, irrigation, and pest management advisory for this stage'}
- Preferred Language: ${isHi ? 'Hindi (हिंदी)' : 'English'}

LIVE WEATHER OBSERVATIONS:
- Temperature: ${currentTemp}°C
- Relative Humidity: ${currentHum}%
- Weather Condition: ${observations?.weather?.description || 'Clear'}
- 7-Day Past Rain (NASA POWER): ${pastRain} mm
- 7-Day Forecast Rain: ${forecastRain} mm
- Solar Radiation: ${solarRad} kWh/m²/day

REPORT STRUCTURE REQUIRED:
1. 🌾 खेत स्थिति सारांश (Field Condition Summary): 1-2 practical sentences assessing the crop stage under these weather conditions.
2. 💧 सिंचाई योजना (Irrigation Decision): Definite instruction (whether to irrigate today, tomorrow, or wait, strictly considering the ${forecastRain} mm forecast rain).
3. 🐛 कीट एवं रोग प्रबंधन (Pest & Disease Advisory): Real disease/pest threat for ${crop} at ${currentHum}% humidity, plus immediate organic (Neem, bio-agent) & recommended chemical treatment.
4. 🧪 उर्वरक एवं छिड़काव खिड़की (Fertilizer & Spray Window): Safe hours for spraying, fertilizer dose, and wind/rain safety.
5. 📅 आगामी 3-दिवसीय कार्ययोजना (3-Day Action Checklist for Farmer): 3 clear actionable bullet points.

CRITICAL LANGUAGE RULE:
${isHi ? '- WRITE THE ENTIRE REPORT 100% IN NATURAL, FLUENT, RESPECTFUL HINDI (देवनागरी लिपि). Do NOT use English paragraphs. Keep it easy for a rural farmer to understand.' : '- Write the entire report in clear, professional English.'}
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
      setReportError(
        isHi
          ? 'परामर्श रिपोर्ट तैयार करने में असमर्थ। कृपया पुनः प्रयास करें।'
          : 'Could not generate report. Please try again.'
      );
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
    utterance.lang = isHi ? 'hi-IN' : 'en-US';
    utterance.rate = 0.95;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    setIsSpeaking(true);
    window.speechSynthesis.speak(utterance);
  };

  // WhatsApp Share
  const handleWhatsAppShare = () => {
    const title = isHi ? `🌾 *कृषि परामर्श रिपोर्ट — ${placeName}*` : `🌾 *Agricultural Advisory Report — ${placeName}*`;
    const cropText = isHi ? `🌱 फसल: ${crop} (${stage})` : `🌱 Crop: ${crop} (${stage})`;
    const content = generatedReport || guidance.map(g => `• *${g.title}*: ${g.text}`).join('\n');
    const msg = `${title}\n${cropText}\n\n${content}\n\n📲 WeatherGPT AI द्वारा संचालित`;
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
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff',
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
              {isHi ? 'मौसम आधारित किसान सेवा' : 'WEATHER AWARE FARMING'}
            </span>
            <h2>{isHi ? 'कृषि परामर्श' : 'Agriculture Advisory'}</h2>
            <p>
              {isHi
                ? 'स्थानीय मौसमी परिस्थितियों और नासा उपग्रह डेटा पर आधारित फसल मार्गदर्शन।'
                : 'Practical crop guidance shaped by current local conditions.'}
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
            <span>{isHi ? 'ताज़ा करें' : 'Refresh'}</span>
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
                {new Date(observations.updatedAt).toLocaleString(isHi ? 'hi-IN' : 'en-US', {
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
                  <h3>{isHi ? 'आपकी फसल का परामर्श' : 'Your crop advisory'}</h3>
                  <p>{isHi ? 'अपनी फसल की जानकारी दर्ज करें और तुरंत विस्तृत रिपोर्ट बनाएं' : 'Personalize the guidance for your field'}</p>
                </div>

                {/* LANGUAGE SELECTION TOGGLE */}
                <div
                  style={{
                    display: 'flex',
                    background: 'rgba(255, 255, 255, 0.08)',
                    padding: '3px',
                    borderRadius: '20px',
                    border: '1px solid rgba(255, 255, 255, 0.15)'
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setAdvisoryLang('hi')}
                    style={{
                      background: isHi ? '#10b981' : 'transparent',
                      color: isHi ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '16px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    🇮🇳 हिंदी
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvisoryLang('en')}
                    style={{
                      background: !isHi ? '#10b981' : 'transparent',
                      color: !isHi ? '#fff' : '#94a3b8',
                      border: 'none',
                      borderRadius: '16px',
                      padding: '4px 10px',
                      fontSize: '11px',
                      fontWeight: 650,
                      cursor: 'pointer'
                    }}
                  >
                    🇬🇧 English
                  </button>
                </div>
              </div>

              {/* CROP & STAGE SELECTORS */}
              <div className="agri-select-grid">
                <label>
                  {isHi ? 'फसल (Crop)' : 'Crop'}
                  <select value={crop} onChange={(event) => setCrop(event.target.value)}>
                    {CROPS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {isHi ? item.hi : item.en}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {isHi ? 'फसल की अवस्था (Growth stage)' : 'Growth stage'}
                  <select value={stage} onChange={(event) => setStage(event.target.value)}>
                    {STAGES.map((item) => (
                      <option key={item.id} value={item.id}>
                        {isHi ? item.hi : item.en}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {/* FARMER INPUT / OBSERVATION FIELD */}
              <div style={{ marginTop: '14px', marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#e2e8f0', marginBottom: '6px' }}>
                  {isHi
                    ? 'खेत की स्थिति, समस्या या प्रश्न दर्ज करें (वैकल्पिक):'
                    : 'Field Situation, Symptoms, or Question (Optional):'}
                </label>
                <textarea
                  value={farmerNotes}
                  onChange={(e) => setFarmerNotes(e.target.value)}
                  placeholder={
                    isHi
                      ? 'उदा. पत्तों पर पीले धब्बे दिख रहे हैं, 3 दिन बाद सिंचाई करनी चाहिए क्या, यूरिया का छिड़काव कब करें...'
                      : 'e.g. Yellow patches on leaves, should I irrigate this week, pesticide dosage needed...'
                  }
                  rows={2}
                  style={{
                    width: '100%',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    color: '#fff',
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
                    { en: '💧 When to irrigate?', hi: '💧 सिंचाई कब करें?' },
                    { en: '🐛 Pest/fungus control', hi: '🐛 कीट व फफूंद रोकथाम' },
                    { en: '🌿 Fertilizer dose', hi: '🌿 खाद व पोषण मात्रा' },
                    { en: '🌦️ Weather safety', hi: '🌦️ मौसम का प्रभाव' },
                  ].map((tag, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setFarmerNotes(isHi ? tag.hi : tag.en)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.06)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '12px',
                        padding: '3px 9px',
                        color: '#94a3b8',
                        fontSize: '11px',
                        cursor: 'pointer'
                      }}
                    >
                      {isHi ? tag.hi : tag.en}
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
                      ? (isHi ? 'मौसम व फसल का विश्लेषण कर रिपोर्ट तैयार हो रही है...' : 'Generating Farm Advisory Report...')
                      : (isHi ? '🌾 विस्तृत कृषि परामर्श रिपोर्ट बनाएं (Generate Report)' : '🌾 Generate Crop Advisory Report')}
                  </span>
                </button>
              </div>

              {/* GENERATED ADVISORY REPORT VIEW */}
              {reportLoading ? (
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(16, 185, 129, 0.04)', borderRadius: '12px', border: '1px dashed rgba(16, 185, 129, 0.3)' }}>
                  <LoaderCircle size={26} className="agri-spin" style={{ margin: '0 auto 10px', color: '#10b981' }} />
                  <p style={{ margin: 0, fontSize: '13px', color: '#34d399', fontWeight: 600 }}>
                    {isHi
                      ? `${placeName} के मौसम और ${crop} की स्थिति की समीक्षा की जा रही है...`
                      : `Analyzing weather & agromet conditions for ${crop}...`}
                  </p>
                </div>
              ) : reportError ? (
                <div style={{ padding: '12px', color: '#f87171', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', fontSize: '12px', marginBottom: '14px' }}>
                  {reportError}
                </div>
              ) : generatedReport ? (
                <div
                  style={{
                    background: 'rgba(15, 23, 42, 0.75)',
                    border: '1px solid rgba(52, 211, 153, 0.35)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px',
                    position: 'relative'
                  }}
                >
                  {/* Report Header Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '10px', marginBottom: '12px' }}>
                    <div>
                      <strong style={{ fontSize: '14px', color: '#34d399', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>📋</span> {isHi ? `कृषि परामर्श रिपोर्ट — ${crop}` : `Crop Advisory Report — ${crop}`}
                      </strong>
                      <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                        {placeName} · {stage} · {isHi ? 'भाषा: हिंदी' : 'Language: English'}
                      </small>
                    </div>

                    {/* Report Action Buttons */}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {/* Audio */}
                      <button
                        type="button"
                        onClick={handleToggleSpeak}
                        title={isHi ? 'आवाज में सुनें' : 'Listen Report'}
                        style={{
                          background: isSpeaking ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
                          border: isSpeaking ? '1px solid #ef4444' : '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          color: isSpeaking ? '#ef4444' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '11px'
                        }}
                      >
                        {isSpeaking ? <VolumeX size={13} /> : <Volume2 size={13} />}
                        <span>{isSpeaking ? (isHi ? 'रोकें' : 'Stop') : (isHi ? 'सुनें' : 'Listen')}</span>
                      </button>

                      {/* Copy */}
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(generatedReport);
                          setCopied(true);
                          setTimeout(() => setCopied(false), 2000);
                        }}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.15)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          color: copied ? '#34d399' : '#fff',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '11px'
                        }}
                      >
                        {copied ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                        <span>{copied ? (isHi ? 'कॉपी हुआ' : 'Copied') : (isHi ? 'कॉपी' : 'Copy')}</span>
                      </button>

                      {/* WhatsApp Share */}
                      <button
                        type="button"
                        onClick={handleWhatsAppShare}
                        title={isHi ? 'व्हाट्सएप शेयर' : 'Share on WhatsApp'}
                        style={{
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: '1px solid rgba(34, 197, 94, 0.4)',
                          borderRadius: '6px',
                          padding: '5px 8px',
                          color: '#4ade80',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: '11px'
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
                      color: '#e2e8f0',
                      lineHeight: '1.7',
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
                {isHi
                  ? 'यह मार्गदर्शन वास्तविक मौसम विज्ञान और कृषि विज्ञान सिद्धांतों पर आधारित है। अंतिम निर्णय से पूर्व खेत का स्थानीय निरीक्षण अवश्य करें।'
                  : 'Guidance is weather-informed and general. Check field conditions and follow local agricultural extension advice for crop-specific decisions.'}
              </p>
            </div>

            {/* RIGHT SIDE: NEXT 7 DAYS FORECAST CARD */}
            <aside className="agri-forecast-card">
              <div className="agri-card-heading">
                <span className="agri-card-heading-icon agri-card-heading-icon--blue">
                  <Wind size={18} />
                </span>
                <div>
                  <h3>Next 7 days</h3>
                  <p>Forecast for {placeName}</p>
                </div>
              </div>

              {observations.forecast?.length ? (
                <div className="agri-forecast-list">
                  {observations.forecast.slice(0, 7).map((day) => (
                    <div className="agri-forecast-row" key={day.date}>
                      <span>{day.dayName}</span>
                      <span className="agri-forecast-weather">
                        {day.icon} {day.description}
                      </span>
                      <strong>
                        {day.maxTemp}° / {day.minTemp}°
                      </strong>
                      <small>
                        <Droplets size={12} /> {formatNumber(day.precipitation)} mm
                      </small>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="agri-no-forecast">Forecast is unavailable at the moment.</p>
              )}
            </aside>
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
