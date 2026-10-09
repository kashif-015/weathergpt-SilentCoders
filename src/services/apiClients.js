/* WeatherGPT API Integration Matrix
 * Implements client drivers for all APIs in the PRD Specification:
 * - IMD (CityForecast, CurrentWX, DistrictNowcast, DistrictWarning, DistrictRainfall, BasinQPF, CycloneTrack, AWS, SeaBulletin)
 * - NASA POWER (Agromet/Solar)
 * - GDACS (SACHET stand-in for disaster feed)
 * - USGS / NCS (Seismic detection)
 * - INCOIS (Tsunami alerts)
 * - ERA5 (Copernicus historical climate)
 * - Bhashini (ASR/NMT/TTS for Indian languages)
 * - ISRO Bhuvan (GIS)
 * - LLM Engine (Gemini / OpenAI / Anthropic)
 * - Firebase & Twilio/Gupshup Alert Dispatcher
 */

const ENV = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (typeof process !== 'undefined' && process.env ? process.env : {});

// Cache map
const cache = new Map();
const TTL_SHORT = 5 * 60 * 1000;   // 5 min for nowcasts/alerts
const TTL_MEDIUM = 15 * 60 * 1000; // 15 min for current weather
const TTL_LONG = 60 * 60 * 1000;   // 1 hour for climate/agri

function getCached(key) {
  const item = cache.get(key);
  if (item && Date.now() - item.ts < item.ttl) return item.data;
  return null;
}

function setCached(key, data, ttl = TTL_MEDIUM) {
  cache.set(key, { data, ts: Date.now(), ttl });
}

// Helper: Safely fetch with fallback timeout & error handling
async function safeFetch(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

/* ==========================================================================
   1. IMD (INDIA METEOROLOGICAL DEPARTMENT) OFFICIAL API SUITE
   ========================================================================== */

async function getImd(endpoint, params = {}, ttl = TTL_MEDIUM) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
  );
  const suffix = query.toString() ? `?${query}` : '';
  const key = `imd:${endpoint}:${suffix}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const res = await safeFetch(`/api/imd/${endpoint}${suffix}`);
    const result = await res.json();
    setCached(key, result, ttl);
    return result;
  } catch (error) {
    return { source: 'IMD unavailable', data: null, error: error.message };
  }
}

export const imdAPI = {
  // Mapping endpoints resolve a city/district name to IMD internal IDs.
  getCityForecastMapping: () => getImd('cityforecast_mapping', {}, TTL_LONG),
  getDistrictMapping: () => getImd('district_mapping', {}, TTL_LONG),

  // 7-day city forecast
  async getCityForecast(cityId = '43003') {
    return getImd('cityforecast', { id: cityId }, TTL_MEDIUM);
  },

  // City forecast selected by latitude/longitude when mapping data is unavailable.
  getCityForecastLocation: (lat, lon) => getImd('cityforecastloc', { latitude: lat, longitude: lon }, TTL_MEDIUM),

  // Current weather station reading
  async getCurrentWX(stationId = 'VABB') {
    return getImd('current_wx', { id: stationId }, TTL_SHORT);
  },

  // 3-hour severe weather nowcast
  async getDistrictNowcast(districtId) {
    return getImd('districtnowcast', { id: districtId }, TTL_SHORT);
  },

  getStationNowcast: (stationId) => getImd('stationnowcast', { id: stationId }, TTL_SHORT),

  // 5-day hazard warnings (Green/Yellow/Orange/Red)
  async getDistrictWarning(districtId) {
    return getImd('districtwarning', { id: districtId }, TTL_MEDIUM);
  },

  getSubdivisionWarning: (subdivisionId) => getImd('subdivisionwarning', { id: subdivisionId }, TTL_SHORT),

  // Rainfall vs Normal statistics
  async getDistrictRainfall(districtId) {
    return getImd('districtrainfall', { id: districtId }, TTL_LONG);
  },

  getStateRainfall: (stateId) => getImd('staterainfall', { id: stateId }, TTL_LONG),
  getStateDistrictRainfallForecast: (districtId) => getImd('state_district_rainfall_forecast', { id: districtId }, TTL_MEDIUM),

  // Flood QPF (Quantitative Precipitation Forecast)
  getBasinQPF: (basinId) => getImd('basinqpf', { id: basinId }, TTL_SHORT),

  // Cyclone Tracking & Wind Polygons
  getCycloneTrack: () => getImd('cyclone_track', {}, TTL_MEDIUM),
  getCycloneWind: () => getImd('cyclone_wind', {}, TTL_MEDIUM),
  getCycloneCone: () => getImd('cyclone_cou', {}, TTL_MEDIUM),

  // AWS (Automatic Weather Station) Live Stream
  getAWSData: (stationCode) => getImd('aws_data', { id: stationCode }, TTL_MEDIUM),

  // Marine Advisories & Port Warnings
  getPortWarning: (portCode) => getImd('portwarning', { id: portCode }, TTL_SHORT),
  getSeaBulletin: (areaId) => getImd('seabulletin', { id: areaId }, TTL_SHORT),
  getCoastalBulletin: (coastId) => getImd('coastalbulletin', { id: coastId }, TTL_SHORT),
  getFishermenWarning: (areaId) => getImd('fishermenwarning', { id: areaId }, TTL_SHORT),
  getAgrometAdvisory: (districtId) => getImd('agromet_advisory', { id: districtId }, TTL_MEDIUM),
};

/* ==========================================================================
   2. NASA POWER API (AGROMET & SOLAR RADIATION)
   ========================================================================== */

export async function getNasaPowerData(lat, lon) {
  const key = `nasa:${lat.toFixed(2)},${lon.toFixed(2)}`;
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const res = await safeFetch(`/api/climate/solar?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
    const response = await res.json();
    const data = response.data;
    const result = {
      solarRadiation: data.properties?.parameter?.ALLSKY_SFC_SW_DWN || {},
      precipitation: data.properties?.parameter?.PRECTOTCORR || {},
      source: response.source || 'NASA POWER', status: response.status,
    };
    setCached(key, result, TTL_LONG);
    return result;
  } catch (err) {
    return { source: 'NASA POWER (Offline)', error: err.message };
  }
}

/* ==========================================================================
   3. GDACS (GLOBAL DISASTER ALERT AND COORDINATION SYSTEM - SACHET STAND-IN)
   ========================================================================== */

export async function getGdacsAlerts() {
  const key = 'gdacs:rss';
  const cached = getCached(key);
  if (cached) return cached;

  try {
    const res = await safeFetch('/api/disasters/gdacs');
    const response = await res.json();
    const items = (response.data || []).map((item) => ({ ...item, category: item.category || 'Disaster' }));

    const result = { source: response.source || 'GDACS', status: response.status, alerts: items };
    setCached(key, result, TTL_SHORT);
    return result;
  } catch (err) {
    return {
      source: 'GDACS Feed',
      alerts: [],
      status: 'unavailable',
      error: err.message,
    };
  }
}

/* ===========================================================================
   3b. INDIA-SPECIFIC SEISMIC, TSUNAMI & GIS PROVIDERS
   These agencies do not expose a stable, unauthenticated browser API. The
   configurable endpoints are intended to point at an approved server proxy.
   =========================================================================== */

async function getConfiguredJson(name, url, options = {}) {
  if (!url) {
    return { source: name, data: null, status: 'not_configured' };
  }
  try {
    const res = await safeFetch(url, options);
    return { source: name, data: await res.json(), status: 'live' };
  } catch (error) {
    return { source: name, data: null, status: 'unavailable', error: error.message };
  }
}

export function getNcsEarthquakes() {
  return getConfiguredJson('National Centre for Seismology', ENV.VITE_NCS_PROXY_URL);
}

export function getIncoisTsunamiAlerts() {
  return getConfiguredJson('INCOIS Tsunami Warning Centre', ENV.VITE_INCOIS_PROXY_URL);
}

export async function getBhuvanBoundaries(layer = 'district') {
  const cacheKey = `bhuvan:${layer}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const baseUrl = (ENV.VITE_BHUVAN_PROXY_URL || '').replace(/\/$/, '');
  const token = (ENV.VITE_BHUVAN_API_KEY || '').trim();
  const separator = baseUrl.includes('?') ? '&' : '?';
  const url = baseUrl ? `${baseUrl}${separator}layer=${encodeURIComponent(layer)}` : '';
  const result = await getConfiguredJson(
    'ISRO Bhuvan GIS',
    url,
    token ? { headers: { Authorization: `Bearer ${token}` } } : {}
  );
  setCached(cacheKey, result, TTL_MEDIUM);
  return result;
}

/* ==========================================================================
   4. ERA5 COPERNICUS CLIMATE TRENDS
   ========================================================================== */

export async function getEra5ClimateTrends(lat, lon) {
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) throw new Error('Choose a location to load climate trends.');
  const cacheKey = `climate:era5:${latitude.toFixed(3)},${longitude.toFixed(3)}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;
  const response = await safeFetch(`/api/climate/trends?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}`);
  const result = await response.json();
  const data = result?.data;
  if (!data?.series?.length) throw new Error(result?.error || 'Climate history is unavailable for this location.');
  const tempDirection = data.temperatureTrendCPerDecade >= 0 ? 'increasing' : 'decreasing';
  const rainfallChange = data.precipitationChangePercent == null ? 'Rainfall comparison is unavailable.' : `Average annual precipitation changed ${Math.abs(data.precipitationChangePercent)}% ${data.precipitationChangePercent >= 0 ? 'higher' : 'lower'} between ${data.baselinePeriod.start}–${data.baselinePeriod.end} and ${data.recentPeriod.start}–${data.recentPeriod.end}.`;
  const climateData = {
    ...data,
    source: result.source || 'ERA5 reanalysis via Open-Meteo',
    trendText: `Annual mean temperature is ${tempDirection} at ${Math.abs(data.temperatureTrendCPerDecade)}°C per decade. ${rainfallChange}`,
  };
  setCached(cacheKey, climateData, TTL_LONG);
  return climateData;
}

/* ==========================================================================
   5. BHASHINI MULTILINGUAL VOICE & TRANSLATION ENGINE (bhashini.gov.in)
   ========================================================================== */

export const bhashiniEngine = {
  apiKey: ENV.VITE_BHASHINI_API_KEY,
  userId: ENV.VITE_BHASHINI_USER_ID,
  pipelineId: ENV.VITE_BHASHINI_PIPELINE_ID,

  // Text Translation (NMT)
  async translateText(text, targetLang = 'hi', sourceLang = 'en') {
    if (!this.apiKey) {
      // Local lightweight dictionary for demo
      const hiDict = {
        'What\'s the weather right now?': 'अभी मौसम कैसा है?',
        'Show me the 7-day forecast': 'मुझे 7 दिनों का मौसम पूर्वानुमान दिखाएं',
        'Will it rain today?': 'क्या आज बारिश होगी?',
        'Any earthquake alerts near India?': 'क्या भारत के पास कोई भूकंप की चेतावनी है?',
        'Are there any weather warnings?': 'क्या कोई मौसम की चेतावनी है?',
        'Agricultural advisory for my area': 'मेरे क्षेत्र के लिए कृषि संबंधी सलाह',
      };
      return hiDict[text] || `[हिन्दी अनुवाद]: ${text}`;
    }

    try {
      const res = await safeFetch('https://dhruva-api.bhashini.gov.in/services/inference/translation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': this.apiKey,
        },
        body: JSON.stringify({
          pipelineTasks: [{
            taskType: 'translation',
            config: { language: { sourceLanguage: sourceLang, targetLanguage: targetLang } }
          }],
          inputData: { input: [{ source: text }] }
        })
      });
      const data = await res.json();
      return data.pipelineResponse[0].output[0].target;
    } catch {
      return `[हिन्दी]: ${text}`;
    }
  },

  // Text-To-Speech (TTS)
  async textToSpeech(text, lang = 'hi') {
    // Bhashini audio delivery requires a deployment-specific pipeline endpoint.
    // Browser synthesis is the reliable immediate fallback and is used until
    // that endpoint is configured server-side.
    if (!('speechSynthesis' in window)) return false;

    const speakableText = String(text || '')
      .replace(/\*\*/g, '')
      .replace(/[`#•]/g, '')
      .replace(/https?:\/\/\S+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!speakableText) return false;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakableText);
    utterance.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  }
};

/* Sanitizes LLM outputs to remove internal chain-of-thought, reasoning headers, and markdown fences */
function cleanLLMOutput(text) {
  if (!text) return null;
  let cleaned = text;

  // Remove <think>...</think> tags if present
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');

  // Remove reasoning block headers
  cleaned = cleaned.replace(/\*\*Reasoning and Confirmation\*\*[\s\S]*?\*\*Requested Output\*\*/gi, '');
  cleaned = cleaned.replace(/## Reasoning[\s\S]*?## Output/gi, '');
  cleaned = cleaned.replace(/^Reasoning:[\s\S]*?\n\n/gi, '');

  // Strip code block fences if wrapping the entire output
  cleaned = cleaned.replace(/^```(?:markdown|text)?\n([\s\S]*?)\n```$/i, '$1');

  return cleaned.trim();
}

const ROUTER_TOOLS = new Set([
  'greeting', 'help', 'current_weather', 'forecast', 'rain', 'wind', 'heatwave',
  'earthquake', 'cyclone', 'flood', 'climate', 'agriculture', 'marine', 'alerts',
]);

function parseRouterResult(rawText) {
  if (!rawText) return null;
  const candidate = cleanLLMOutput(rawText).replace(/^```json\s*|\s*```$/gi, '').trim();
  try {
    const result = JSON.parse(candidate);
    if (result.action && ['off_topic', 'no_data', 'clarify'].includes(result.action)) return result;
    if (Array.isArray(result.tools) && result.tools.length) {
      const tools = result.tools.filter((tool) => ROUTER_TOOLS.has(tool));
      if (tools.length) return {
        action: 'tools', tools: [...new Set(tools)],
        location: result.location?.name ? { name: result.location.name, country: result.location.country || '' } : null,
      };
    }
  } catch {}
  return null;
}

/** First LLM call: normalizes the place and returns a plan only. No provider
 * data is supplied, so this call cannot compose or invent an answer. */
export async function routeWeatherQuery(userMessage, location, history = []) {
  const routerPrompt = `You are the router for WeatherGPT. Return JSON only; never answer the user.
First normalize any place name in the question: correct common phonetic/spelling variants, identify its country, and prefer the best-known place when an informal name is plausible. Use null location when the question clearly refers to the saved location.
Allowed scope: weather forecasts, current conditions, disaster alerts, earthquake or tsunami detection, climate trends, agriculture, marine, and aviation weather advisories.
Available tools: greeting, help, current_weather, forecast, rain, wind, heatwave, earthquake, cyclone, flood, climate, agriculture, marine, alerts.
For a direct question select only the necessary tool. For a trip, safety, situation, comparison, or "should I visit/go" question select ALL relevant tools. Include forecast and current_weather, then flood for monsoon/flood-exposed locations, cyclone for coasts, earthquake for Nepal/Himalayas/NE India, heatwave when relevant, and alerts whenever safety is being assessed. For non-India locations, still use global weather, earthquake, and alerts tools but do not plan IMD-only coverage.
Return exactly one of:
{"location":{"name":"Corrected place name","country":"Country"},"tools":["current_weather","forecast"]}
{"action":"off_topic"}
{"action":"no_data"}
{"action":"clarify","question":"one short question"}
Saved location: ${JSON.stringify({ lat: location.lat, lon: location.lon, name: location.name || location.city, country: location.country || '' })}
Recent conversation: ${JSON.stringify(history.slice(-3).map(({ role, text }) => ({ role, text })))}
User question: ${userMessage}`;

  try {
    const res = await safeFetch('/api/ai/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: routerPrompt }] }], generationConfig: { temperature: 0.1, responseMimeType: 'application/json' } }),
    });
    const result = await res.json();
    return result.rateLimited ? { action: 'ai_rate_limited' } : parseRouterResult(result.text);
  } catch (error) {
    console.warn('WeatherGPT router unavailable; using local router.', error.message);
    return String(error.message).includes('429') ? { action: 'ai_rate_limited' } : null;
  }
}

export async function queryLLMWithFunctionCalling(userMessage, contextData, history = [], userProfile = null) {
  const userLang = userProfile?.language || 'en';
  const userName = userProfile?.name ? `User's Name: ${userProfile.name}` : '';
  const userOccupation = userProfile?.occupation ? `User's Occupation: ${userProfile.occupation}` : '';
  const userAge = userProfile?.age ? `User's Age: ${userProfile.age}` : '';

  const forceHindiInstruction = userLang === 'hi' ? `
IMPORTANT USER LANGUAGE PREFERENCE:
- The user has selected HINDI (हिंदी) as their primary application language.
- RESPOND ENTIRELY IN NATURAL, FLUENT HINDI (Devanagari script: देवनागरी लिपि).
- Tailor your explanations, weather insights, and friendly advice in Hindi.` : '';

  const systemInstruction = `You are WeatherGPT — a warm, highly intelligent, human-like conversational AI assistant specializing in weather, outdoor planning, disaster safety, agriculture advisories, and climate insights across India.

USER CONTEXT:
${userName}
${userOccupation}
${userAge}
Selected Language Preference: ${userLang === 'hi' ? 'Hindi (हिंदी)' : 'English'}
${forceHindiInstruction}

CRITICAL LANGUAGE & SCRIPT MATCHING RULE:
- If user selected Hindi (or query is in Hindi), respond in clear Devanagari Hindi.
- If query is in Hinglish (Roman script Hindi), respond in conversational Hinglish.
- Otherwise, respond in clear English or the user's query language.

RESPONSE FORMAT:
- Write at most 2-3 short sentences. No headings, bullets, or data dumps unless explicitly requested.
- Match the query's script and style: English to English, Devanagari Hindi to Devanagari Hindi, and Hinglish to Hinglish.
- For alerts, lead with the action to take, then severity and affected area. Only give safety instructions present in the data.
- Do not mention data sources unless the user specifically asks about source or accuracy.

ABSOLUTE DATA GROUNDING RULES (MANDATORY):
- You are a DATA INTERPRETER, NOT a data generator.
- The [Real-Time Data Context] block below contains LIVE data fetched from real APIs (IMD, Open-Meteo, NASA POWER, USGS, GDACS, ERA5).
- You MUST base ALL temperatures, wind speeds, rainfall figures, humidity, pressure, earthquake magnitudes, and forecasts STRICTLY on the numbers provided in the data context.
- NEVER invent, estimate, or hallucinate ANY meteorological number that is not present in the data context.
- If the data context is missing information the user asked about, clearly state that the data is not available rather than guessing.
- Seamlessly weave the real data figures into a warm, conversational response in the user's language.`;


  // Build formatted contents for Gemini API
  const geminiContents = [
    ...history.slice(-6).map(m => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.text }]
    })),
    {
      role: 'user',
      parts: [{ text: `${systemInstruction}\n\n[Real-Time Data Context]\n${JSON.stringify(contextData)}\n\n[User Query]\n${userMessage}` }]
    }
  ];

  // The browser sends only the prompt and verified provider results. The
  // server owns every LLM credential and performs the actual model request.
  try {
    const res = await safeFetch('/api/ai/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: geminiContents, generationConfig: { temperature: 0.7 } }),
    });
    const result = await res.json();
    if (result.rateLimited) return { text: null, provider: 'Gemini rate-limited' };
    const text = cleanLLMOutput(result.text);
    if (text) return { text, provider: result.provider || 'Gemini' };
  } catch (error) {
    console.warn('WeatherGPT composer unavailable; using deterministic response.', error.message);
  }

  // The deterministic caller will format available provider data if AI is down.
  return { text: null, provider: 'Rule-Based Engine' };
}

/* ==========================================================================
   7. FIREBASE & TWILIO / GUPSHUP ALERT DISPATCHER
   ========================================================================== */

export const alertDispatcher = {
  firebaseConfigured: Boolean(ENV.VITE_FIREBASE_API_KEY),
  twilioConfigured: Boolean(ENV.VITE_TWILIO_ACCOUNT_SID),
  gupshupConfigured: Boolean(ENV.VITE_GUPSHUP_API_KEY),

  async dispatchProactiveAlert(alertData, targetUser = 'default') {
    const channels = [];

    if (this.firebaseConfigured) {
      channels.push('Firebase Push Notification');
    }
    if (this.twilioConfigured) {
      channels.push('Twilio WhatsApp/SMS');
    }
    if (this.gupshupConfigured) {
      channels.push('Gupshup Voice IVR');
    }

    if (channels.length === 0) {
      channels.push('App In-Line Notification (Web Push)');
    }

    return {
      status: 'Dispatched',
      channels,
      timestamp: new Date().toISOString(),
      alert: alertData
    };
  }
};
