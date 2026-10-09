/* WeatherGPT — Multi-Source Chat & NLU Engine
 * Powered by IMD, NASA POWER, GDACS, USGS, Bhashini, ERA5 & LLM function-calling
 */

import {
  geocodeCity,
  getCurrentWeather,
  getForecast,
  getHistoricalWeather,
  getIndiaEarthquakes,
  getRecentEarthquakes,
  getUserLocation,
} from './weatherService.js';

import {
  imdAPI,
  getNasaPowerData,
  getGdacsAlerts,
  getEra5ClimateTrends,
  getIncoisTsunamiAlerts,
  getBhuvanBoundaries,
  bhashiniEngine,
  queryLLMWithFunctionCalling,
  routeWeatherQuery,
  alertDispatcher,
} from './apiClients.js';

// Intent matchers
const INTENTS = [
  { type: 'location', patterns: [/\b(?:live|current|my)\s+location\b/i, /\bwhere am i\b/i, /\bmera location\b/i, /\bmeri location\b/i, /\blocate me\b/i, /\bdetect.*location\b/i, /\bmeri jagah\b/i] },
  { type: 'forecast', patterns: [/forecast/i, /next\s*\d+\s*days?/i, /week/i, /upcoming/i, /tomorrow/i, /this week/i, /\bwill it\b/i] },
  { type: 'current', patterns: [/current/i, /right now/i, /now/i, /today/i, /temperature/i, /weather in/i, /how.*weather/i, /what.*weather/i, /\bhot\b/i, /\bcold\b/i, /mausam/i] },
  { type: 'rain', patterns: [/rain/i, /rainfall/i, /precipitation/i, /umbrella/i, /drizzle/i, /shower/i, /monsoon/i, /barish/i, /baarish/i, /pani/i] },
  { type: 'earthquake', patterns: [/earthquake/i, /quake/i, /seismic/i, /tremor/i, /bhukamp/i, /tsunami/i] },
  { type: 'cyclone', patterns: [/cyclone/i, /hurricane/i, /typhoon/i, /storm/i, /toofan/i] },
  { type: 'marine', patterns: [/marine/i, /sea/i, /coastal/i, /port/i, /fisherm[ae]n/i, /boat/i, /sailing/i] },
  { type: 'flood', patterns: [/flood/i, /flooding/i, /water level/i, /baadh/i, /river/i, /qpf/i] },
  { type: 'heatwave', patterns: [/heatwave/i, /heat wave/i, /loo/i, /extreme heat/i, /scorching/i, /garmi/i] },
  { type: 'wind', patterns: [/wind/i, /windy/i, /gust/i, /breeze/i, /hawa/i] },
  { type: 'climate', patterns: [/climate/i, /trend/i, /historical/i, /global warming/i, /era5/i, /past/i] },
  { type: 'agriculture', patterns: [/crop/i, /farm/i, /sowing/i, /harvest/i, /agriculture/i, /kisan/i, /kheti/i, /fasal/i, /nasa/i, /soil/i] },
  { type: 'alert', patterns: [/alert/i, /warning/i, /danger/i, /safe/i, /risk/i, /disaster/i, /khatre/i, /sachet/i, /gdacs/i] },
  { type: 'greeting', patterns: [/^(hi|hello|hey|namaste|namaskar|good morning|good evening|kaisa h|kya haal)/i] },
  { type: 'help', patterns: [/help/i, /what can you/i, /capabilities/i, /features/i, /kya kar/i] },
];

function extractCity(query) {
  // Hinglish travel/safety phrasing: take the words immediately before the
  // action phrase, rather than treating the whole sentence as a place name.
  const travelMatch = query.match(/^\s*(?:kya\s+)?(.+?)\s+(?:ghumne|ghoomne|visit|travel|jaana|jana)\s+(?:jana|jaana|jayen|jaye|chahiye|safe)/i);
  if (travelMatch) return travelMatch[1].trim().replace(/^(?:mein|me|in|to)\s+/i, '');
  const patterns = [
    /(?:weather|forecast|rain|temperature|humidity|wind|climate|alert|trip|going to|visit|in|at|for|of|ka|ki|me|mein)\s+([A-Za-z\s]+?)(?:\?|$|today|tomorrow|this|next|week|month)/i,
    /(?:in|at|for|of)\s+([A-Za-z]+)/i,
    /([A-Za-z]+)\s+(?:weather|forecast|mein|ka|ki|me)\b/i,
  ];

  for (const p of patterns) {
    const match = query.match(p);
    if (match) {
      const city = match[1].trim().replace(/[?.!,]/g, '');
      if (city.length > 2 && city.length < 35 && !['today', 'tomorrow', 'weather', 'forecast', 'what', 'how', 'when', 'will', 'this', 'aaj', 'kal', 'kaisa', 'kaise', 'location', 'live location', 'current location', 'here', 'my city', 'my area', 'my location'].includes(city.toLowerCase())) {
        return city;
      }
    }
  }
  return null;
}

function normalizeLocationName(name) {
  if (!name) return null;
  const aliases = {
    bhopol: 'Bhopal', bombay: 'Mumbai', calcutta: 'Kolkata', madras: 'Chennai', katmandu: 'Kathmandu',
    'balmiki nagar': 'Valmiki Nagar', 'valmiki nagar': 'Valmiki Nagar',
  };
  return aliases[name.trim().toLowerCase()] || name.trim();
}

async function fetchMultiToolData(tools, location, isIndia) {
  const requests = [];
  const add = (name, promise) => requests.push(Promise.resolve(promise).then((data) => [name, data]));
  const needs = (name) => tools.includes(name);

  if (needs('current_weather') || needs('rain') || needs('wind') || needs('heatwave') || needs('flood')) {
    add('currentWeather', getCurrentWeather(location.lat, location.lon));
  }
  if (needs('forecast') || needs('rain') || needs('flood')) add('forecast', getForecast(location.lat, location.lon));
  if (needs('alerts')) add('gdacsAlerts', getGdacsAlerts());
  if (needs('cyclone')) {
    add('gdacsCycloneAlerts', getGdacsAlerts());
    if (isIndia) {
      add('imdCycloneTrack', imdAPI.getCycloneTrack());
      add('imdCycloneWind', imdAPI.getCycloneWind());
    }
  }
  if (needs('earthquake')) add('earthquakes', isIndia ? getIndiaEarthquakes() : getRecentEarthquakes(4));
  // IMD district/basin endpoints require official internal IDs. Do not call
  // them with an empty ID: that creates a 503 and is not a valid warning.
  // GDACS and the global forecast remain valid safety sources until mapping
  // data resolves an actual IMD district/basin identifier.
  if (needs('climate')) add('climate', getEra5ClimateTrends(location.lat, location.lon));
  if (needs('agriculture')) add('nasaPower', getNasaPowerData(location.lat, location.lon));
  if (needs('marine') && isIndia) {
    add('imdMarine', Promise.all([imdAPI.getPortWarning(), imdAPI.getSeaBulletin(), imdAPI.getCoastalBulletin()]));
  }
  const settled = await Promise.allSettled(requests);
  return Object.fromEntries(settled
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value));
}

function isJudgmentQuery(query) {
  return /\b(should i|safe to|is it safe|visit|travel|trip|plan|go to|going to|situation|compare|ghumne|ghoomne|jana chahiye|jaana chahiye|safe hai|ja sakte)\b/i.test(query);
}

function isCoastalLocation(location) {
  const coastalNames = /mumbai|goa|kochi|kozhikode|chennai|puducherry|visakhapatnam|vizag|kolkata|puri|bhubaneswar|port blair|mangalore|thiruvananthapuram/i;
  return coastalNames.test(location.name || location.city || '');
}

function isHighSeismicLocation(location) {
  const name = `${location.name || ''} ${location.country || ''}`;
  return /nepal|bhutan|kathmandu|sikkim|arunachal|assam|meghalaya|manipur|mizoram|nagaland|tripura|jammu|kashmir|ladakh|himachal|uttarakhand/i.test(name)
    || (location.lat >= 26 && location.lat <= 36 && location.lon >= 72 && location.lon <= 98);
}

function buildFallbackPlan(query, fallbackIntent, location) {
  if (!isJudgmentQuery(query)) return [({ current: 'current_weather', alert: 'alerts' }[fallbackIntent] || fallbackIntent)];
  const tools = ['current_weather', 'forecast', 'alerts'];
  if (/rain|flood|monsoon|safe|visit|travel|trip|situation/i.test(query)) tools.push('flood');
  if (isCoastalLocation(location)) tools.push('cyclone');
  if (isHighSeismicLocation(location)) tools.push('earthquake');
  if (/heat|cold|summer|winter|safe|visit|travel|trip/i.test(query)) tools.push('heatwave');
  return [...new Set(tools)];
}

function compositeFallbackText(location, data, query) {
  const weather = data.currentWeather;
  const nextDay = data.forecast?.[0];
  const quakes = data.earthquakes || [];
  const alerts = data.gdacsAlerts?.alerts || data.gdacsAlerts?.data || [];
  const relevantAlert = alerts.find((alert) => new RegExp(location.split(/\s+/).join('|'), 'i').test(`${alert.title || ''} ${alert.description || ''}`));
  const pieces = [];
  if (weather && nextDay) {
    const rainAdvice = Number(nextDay.precipitation || 0) >= 5 ? 'Rain gear and flexible outdoor plans are advisable.' : 'Weather conditions alone do not indicate a major disruption.';
    pieces.push(`${location} is currently ${weather.temp}°C with ${weather.description.toLowerCase()}; today is forecast to reach ${nextDay.maxTemp}°C with ${nextDay.precipitation || 0} mm of precipitation. ${rainAdvice}`);
  }
  if (relevantAlert) pieces.push(`GDACS has an alert relevant to the area: ${relevantAlert.title}.`);
  else if (data.gdacsAlerts) pieces.push('No GDACS alert matched this destination in the latest feed.');
  if (quakes.length && /visit|travel|trip|ghumne|ghoomne|jana|safe/i.test(query)) pieces.push('USGS regional seismic activity was also checked; review the listed events if you need a detailed seismic assessment.');
  return pieces.join(' ') || `I could not retrieve enough live data for ${location} right now.`;
}

function detectIntent(query) {
  for (const intent of INTENTS) {
    if (intent.patterns.some(p => p.test(query))) return intent.type;
  }
  return 'general';
}

function windDirection(deg) {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  return dirs[Math.round(deg / 22.5) % 16];
}

function toIsoDate(year, month, day) {
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1 || parsed.getUTCDate() !== Number(day)) return null;
  return parsed.toISOString().slice(0, 10);
}

function isPastDate(date) {
  return date && date < new Date().toISOString().slice(0, 10);
}

// Returns a date only when the query is unambiguously historical. "Kal" is
// treated as yesterday only with past-tense wording, avoiding a change to the
// existing Hinglish tomorrow forecast behaviour.
function extractHistoricalDate(query) {
  const lower = query.toLowerCase();
  const relative = /\b(day before yesterday|the day before)\b|परसों.*था|parso[n]?\s+(?:ka|ki).*(?:tha|thi|hui)/i.test(query)
    ? 2
    : /\b(yesterday|yday)\b|\bkal\b.*\b(?:tha|thi|hui|huyi|gaya)\b|कल.*(?:था|थी|हुई|गया)|\b(last|previous)\s+day\b/i.test(query)
      ? 1
      : 0;
  if (relative) {
    const date = new Date();
    date.setDate(date.getDate() - relative);
    return date.toISOString().slice(0, 10);
  }

  let match = lower.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (match) {
    const date = toIsoDate(match[1], match[2], match[3]);
    return isPastDate(date) ? date : null;
  }
  match = lower.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);
  if (match) {
    const date = toIsoDate(match[3], match[2], match[1]); // Indian DD/MM/YYYY convention
    return isPastDate(date) ? date : null;
  }
  match = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\s*,?\s*(\d{4})\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\s*,?\s*(\d{4})\b/i);
  if (match) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const day = match[1] || match[5];
    const month = months.indexOf((match[2] || match[4]).toLowerCase()) + 1;
    const year = match[3] || match[6];
    const date = toIsoDate(year, month, day);
    return isPastDate(date) ? date : null;
  }

  // A date without a year means the most recent occurrence of that date.
  // This covers natural Hinglish requests such as "10 September ko ... hua tha".
  match = lower.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(january|february|march|april|may|june|july|august|september|october|november|december)\b|\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i);
  if (match) {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const day = Number(match[1] || match[4]);
    const month = months.indexOf((match[2] || match[3]).toLowerCase()) + 1;
    const now = new Date();
    let date = toIsoDate(now.getFullYear(), month, day);
    if (!isPastDate(date)) date = toIsoDate(now.getFullYear() - 1, month, day);
    return date;
  }
  return null;
}

function extractHistoricalCity(query) {
  const match = query.match(/\b(?:in|at)\s+([A-Za-z][A-Za-z\s-]{2,40}?)(?=\s+(?:on|yesterday|yday|last|\d{1,4}[-/.]|january|february|march|april|may|june|july|august|september|october|november|december)\b|[?.!,]|$)/i)
    || query.match(/\b([A-Za-z][A-Za-z\s-]{2,40}?)\s+(?:me|mein)\s+(?:kal|yesterday)/i)
    || query.match(/(?:\b(?:ko|on)\s+)([A-Za-z][A-Za-z\s-]{2,40}?)\s+(?:me|mein)\b/i);
  return match?.[1]?.trim() || null;
}

function historicalFallbackText(location, weather, userProfile) {
  const temperature = weather.meanTemp ?? weather.maxTemp;
  const rainText = weather.didRain
    ? `Yes, rain was recorded: ${weather.rainSum} mm${weather.precipitationHours != null ? ` over ${weather.precipitationHours} hour(s)` : ''}.`
    : 'No rain was recorded.';
  if (userProfile?.language === 'hi') {
    return `**${location} — ${weather.date}**\n\n${weather.icon} ${weather.description}. तापमान ${temperature ?? 'उपलब्ध नहीं'}°C था (न्यूनतम ${weather.minTemp ?? '—'}°C, अधिकतम ${weather.maxTemp ?? '—'}°C)। ${weather.didRain ? `${weather.rainSum} मिमी बारिश दर्ज हुई।` : 'बारिश दर्ज नहीं हुई।'}`;
  }
  return `**${location} — ${weather.date}**\n\n${weather.icon} ${weather.description}. Temperature was ${temperature ?? 'unavailable'}°C (low ${weather.minTemp ?? '—'}°C, high ${weather.maxTemp ?? '—'}°C). ${rainText}`;
}

export async function processQuery(query, userLocation, history = [], userProfile = null) {
  const fallbackIntent = detectIntent(query);
  let location = userLocation || { lat: 28.6139, lon: 77.209, city: 'New Delhi', name: 'New Delhi', country: 'India' };
  const historicalDate = extractHistoricalDate(query);

  // Historical requests bypass the forecast/current router so past-tense
  // Hinglish queries always reach the archive data source.
  if (historicalDate) {
    const historicalCity = normalizeLocationName(extractHistoricalCity(query) || extractCity(query));
    if (historicalCity) {
      try { location = await geocodeCity(historicalCity); } catch { /* use saved location */ }
    }
    if (!location?.lat) location = { lat: 28.6139, lon: 77.209, city: 'New Delhi', name: 'New Delhi' };
    const locName = historicalCity || location.name || location.city || 'New Delhi';
    try {
      const historicalWeather = await getHistoricalWeather(location.lat, location.lon, historicalDate);
      const llmResult = await queryLLMWithFunctionCalling(query, {
        location: locName,
        historicalWeather,
      }, history, userProfile);
      return {
        type: 'text',
        text: llmResult.text || historicalFallbackText(locName, historicalWeather, userProfile),
        source: ['Open-Meteo Historical Weather API', ...(llmResult.text ? [llmResult.provider] : [])],
        location,
      };
    } catch (err) {
      return {
        type: 'text',
        text: userProfile?.language === 'hi'
          ? `उस तारीख के लिए ऐतिहासिक मौसम डेटा उपलब्ध नहीं है। कृपया दूसरी पिछली तारीख आज़माएँ।`
          : `Historical weather data is unavailable for ${historicalDate}. Please try another past date.`,
        source: ['Open-Meteo Historical Weather API'],
      };
    }
  }
  const route = await routeWeatherQuery(query, location, history);
  const cityName = route?.location?.name || normalizeLocationName(extractCity(query));

  if (cityName) {
    try {
      location = await geocodeCity(cityName);
    } catch {
      // Keep user location if geocoding fails
    }
  }

  if (!location?.lat) {
    location = { lat: 28.6139, lon: 77.209, city: 'New Delhi', name: 'New Delhi' };
  }

  if (route?.location?.country) location.country = route.location.country;
  const locName = cityName || location.name || location.city || 'New Delhi';
  const isIndia = (location.country || route?.location?.country || '').toLowerCase().includes('india');
  const plannedTools = route?.action === 'tools'
    ? route.tools
    : buildFallbackPlan(query, fallbackIntent, location);

  try {
    // Call 1: routing only. The router never receives live provider data and
    // therefore cannot generate a weather answer. Regex matching is used only
    // when no LLM key is configured or the router is unavailable.
    if (route?.action === 'off_topic') {
      const llmResult = await queryLLMWithFunctionCalling(query, { note: 'Conversational or general question. Respond helpfully, politely and concisely in the user language, mentioning WeatherGPT can provide live weather and disaster alerts.' }, history, userProfile);
      if (llmResult.text) {
        return { type: 'text', source: [llmResult.provider || 'Gemini'], text: llmResult.text };
      }
      return { type: 'text', source: ['WeatherGPT Router'], text: "I'm here for weather and disaster information—ask me about forecasts or alerts in any location." };
    }
    if (route?.action === 'no_data') {
      const llmResult = await queryLLMWithFunctionCalling(query, { note: 'Specific weather data unavailable. Politely explain and offer to check current weather or forecast.' }, history, userProfile);
      if (llmResult.text) {
        return { type: 'text', source: [llmResult.provider || 'Gemini'], text: llmResult.text };
      }
      return { type: 'text', source: ['WeatherGPT Router'], text: "I don't have data for that right now. Try current conditions or the forecast." };
    }
    if (route?.action === 'clarify') {
      return { type: 'text', source: ['WeatherGPT Router'], text: route.question || 'Which location would you like to check?' };
    }
    const skipComposer = route?.action === 'ai_rate_limited';
    if (plannedTools.length > 1) {
      const data = await fetchMultiToolData(plannedTools, location, isIndia);
      const llmResult = skipComposer
        ? { text: null, provider: 'AI rate-limited' }
        : await queryLLMWithFunctionCalling(query, { location: locName, country: location.country || route?.location?.country || '', requestedChecks: plannedTools, ...data }, history, userProfile);
      const sources = [
        'Open-Meteo',
        ...(data.gdacsAlerts ? ['GDACS'] : []),
        ...(data.earthquakes ? ['USGS'] : []),
        ...(data.imdCycloneTrack || data.imdCycloneWind ? ['IMD'] : []),
      ];
      return {
        type: 'text', source: sources,
        text: llmResult.text || compositeFallbackText(locName, data, query),
      };
    }
    const routedTool = plannedTools[0];
    const intent = ({ current_weather: 'current', alerts: 'alert' }[routedTool] || routedTool || fallbackIntent);

    switch (intent) {
      case 'location': {
        let freshLoc = location;
        try {
          freshLoc = await getUserLocation(true);
        } catch {}
        const weather = await getCurrentWeather(freshLoc.lat, freshLoc.lon);
        const sources = ['Live Geolocation', 'Open-Meteo'];
        const llmResult = await queryLLMWithFunctionCalling(query, {
          weather,
          location: freshLoc.city || freshLoc.name,
          state: freshLoc.state,
          country: freshLoc.country,
          coordinates: { lat: freshLoc.lat, lon: freshLoc.lon }
        }, history, userProfile);
        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'weather', text: llmResult.text, data: weather, source: sources, location: freshLoc, weather, isUserLocation: true };
        }
        const isHindi = userProfile?.language === 'hi';
        const text = isHindi
          ? `📍 **आपकी लाइव लोकेशन:** **${freshLoc.city || freshLoc.name}** (${freshLoc.state ? freshLoc.state + ', ' : ''}${freshLoc.country || ''})\n\n🌡️ **वर्तमान मौसम:** ${weather.temp}°C, ${weather.description} (महसूस हो रहा है: ${weather.feelsLike}°C)\n💧 **नमी:** ${weather.humidity}%\n💨 **हवा:** ${weather.windSpeed} km/h\n📊 **निर्देशांक:** ${freshLoc.lat.toFixed(4)}°N, ${freshLoc.lon.toFixed(4)}°E`
          : `📍 **Your Detected Live Location:** **${freshLoc.city || freshLoc.name}** (${freshLoc.state ? freshLoc.state + ', ' : ''}${freshLoc.country || ''})\n\n🌡️ **Current Weather:** ${weather.temp}°C, ${weather.description} (Feels like: ${weather.feelsLike}°C)\n💧 **Humidity:** ${weather.humidity}%\n💨 **Wind:** ${weather.windSpeed} km/h\n📊 **Coordinates:** ${freshLoc.lat.toFixed(4)}°N, ${freshLoc.lon.toFixed(4)}°E (Source: ${freshLoc.source || 'GPS/IP'})`;
        return { type: 'weather', text, data: weather, source: sources, location: freshLoc, weather, isUserLocation: true };
      }

      case 'greeting': {
        const weather = await getCurrentWeather(location.lat, location.lon);
        const sources = ['Open-Meteo'];
        const llmResult = await queryLLMWithFunctionCalling(query, { weather, location: locName }, history, userProfile);
        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources };
        }
        const isHindi = userProfile?.language === 'hi';
        return {
          type: 'text', source: sources,
          text: isHindi
            ? `नमस्ते! 🙏 मैं वेदर-जीपीटी हूँ। ${locName} में अभी ${weather.temp}°C तापमान है। मौसम, यात्रा, फसल सलाह या चेतावनी के बारे में पूछें!`
            : `Namaste! 🙏 I am WeatherGPT. It's currently ${weather.temp}°C in ${locName}. Ask me about weather, travel, crop advisories, or disaster alerts!`,
        };
      }

      case 'help': {
        const sources = ['WeatherGPT Assistant'];
        const llmResult = await queryLLMWithFunctionCalling(query, {
          location: locName,
          guideTopic: 'Capabilities & User Assistance',
          features: ['Live Weather & Travel', '7-Day Forecast', 'Monsoon & Rain Alerts', 'Earthquakes & Tsunami', 'Cyclone Tracking', 'Agromet & Crop Advice', 'Climate Insights']
        }, history, userProfile);
        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources };
        }
        return {
          type: 'text',
          text: userProfile?.language === 'hi'
            ? `WeatherGPT आपकी सहायता निम्नलिखित विषयों में कर सकता है:\n\n🌤️ **लाइव मौसम व यात्रा सलाह** — "जयपुर में मौसम कैसा है?"\n📅 **7-दिवसीय पूर्वानुमान** — "क्या दिल्ली में सप्ताहांत बारिश होगी?"\n🌧️ **मानसून सलाह** — "क्या मुंबई में आज छाते की जरूरत है?"\n🔴 **भूकंप अलर्ट** — "उत्तर भारत के आसपास हाल के भूकंप?"\n🌾 **नासा एवं कृषि सलाह** — "पंजाब के किसानों के लिए सिंचाई परामर्श"\n📊 **जलवायु रुझान** — "चेन्नई में तापमान में क्या बदलाव आया है?"`
            : `Here is what WeatherGPT can assist you with in any language (English, Hinglish, Hindi, etc.):\n\n🌤️ **Live Weather & Travel** — "How's the weather in Jaipur?" / "Delhi me aaj mausam kaisa hai?"\n📅 **7-Day Forecasts** — "Will it rain in Delhi this weekend?" / "Kya kal barish hogi?"\n🌧️ **Monsoon & Outdoor Advice** — "Do I need an umbrella in Mumbai today?"\n🔴 **Seismic Activity** — "Any earthquake reports near North India?"\n⛈️ **Cyclones & Storms** — "Is there any cyclone threat in Bengal?"\n🌾 **NASA Agromet Advisories** — "Crop watering advisory for Punjab farmers"\n📊 **ERA5 Climate Trends** — "How has summer temperature changed in Chennai?"\n🔔 **Disaster Push Alerts** — "Check active severe weather warnings"`,
        };
      }

      case 'current':
      case 'rain':
      case 'wind':
      case 'heatwave': {
        const weather = await getCurrentWeather(location.lat, location.lon);
        const sources = ['Open-Meteo'];

        const llmResult = await queryLLMWithFunctionCalling(query, { weather, location: locName }, history, userProfile);

        let text = llmResult.text;
        if (text) {
          sources.push(llmResult.provider);
        } else {
          text = `**${weather.icon} ${locName}** — ${weather.description}\n\n`;
          text += `🌡️ **${weather.temp}°C** (${userProfile?.language === 'hi' ? 'महसूस हो रहा है' : 'Feels like'} ${weather.feelsLike}°C)\n`;
          text += `💧 ${userProfile?.language === 'hi' ? 'नमी' : 'Humidity'}: ${weather.humidity}%\n`;
          text += `💨 ${userProfile?.language === 'hi' ? 'हवा' : 'Wind'}: ${weather.windSpeed} km/h ${windDirection(weather.windDir)}\n`;
          text += `📊 ${userProfile?.language === 'hi' ? 'वायुमण्डलीय दबाव' : 'Barometric Pressure'}: ${weather.pressure} hPa`;
        }

        return { type: 'weather', text, data: weather, source: sources, location, weather };
      }

      case 'forecast': {
        const forecast = await getForecast(location.lat, location.lon);
        const sources = ['Open-Meteo'];

        const llmResult = await queryLLMWithFunctionCalling(query, { forecast, location: locName }, history, userProfile);

        let text = llmResult.text;
        if (text) {
          sources.push(llmResult.provider);
        } else {
          text = `📅 **7-Day Forecast for ${locName}**\n\n`;
          forecast.forEach(day => {
            text += `${day.icon} **${day.dayName}** — Max ${day.maxTemp}°C / Min ${day.minTemp}°C · ${day.description}`;
            if (day.precipitation > 0) text += ` · 🌧️ ${day.precipitation}mm`;
            text += '\n';
          });
        }

        return { type: 'forecast', text, data: forecast, source: sources };
      }

      case 'earthquake': {
        const isTsunamiQuery = /tsunami/i.test(query);
        const [quakes, tsunami] = await Promise.all([
          getIndiaEarthquakes(),
          isTsunamiQuery ? getIncoisTsunamiAlerts() : Promise.resolve(null),
        ]);
        const sources = ['USGS Earthquake Feed'];
        if (tsunami) sources.push(tsunami.source);
        const llmResult = await queryLLMWithFunctionCalling(query, {
          earthquakes: quakes.slice(0, 5), tsunamiAlerts: tsunami?.data || null,
        }, history, userProfile);

        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'earthquake', text: llmResult.text, data: quakes.slice(0, 5), source: sources };
        }

        if (!quakes.length) {
          return { type: 'text', source: sources, text: userProfile?.language === 'hi' ? '🟢 पिछले 30 दिनों में कोई बड़ा भूकंप दर्ज नहीं।' : '🟢 No significant seismic activity reported recently.' };
        }

        let text = `🔴 **Real-Time Seismic Activity**\n\n`;
        quakes.slice(0, 5).forEach(q => {
          const emoji = q.severity === 'severe' ? '🔴' : q.severity === 'strong' ? '🟠' : q.severity === 'moderate' ? '🟡' : '🟢';
          text += `${emoji} **M${q.magnitude.toFixed(1)}** — ${q.place}\n`;
          text += `   📍 Depth: ${q.depth.toFixed(1)} km · 🕒 ${q.time}\n\n`;
        });
        return { type: 'earthquake', text, data: quakes.slice(0, 5), source: sources };
      }

      case 'cyclone': {
        const [weather, gdacs, track, wind, cone] = await Promise.all([
          getCurrentWeather(location.lat, location.lon), getGdacsAlerts(),
          imdAPI.getCycloneTrack(), imdAPI.getCycloneWind(), imdAPI.getCycloneCone(),
        ]);
        const sources = ['Open-Meteo', gdacs.source, track.source, wind.source, cone.source];
        const cycloneAlerts = gdacs.alerts.filter(a => a.category.toLowerCase().includes('cyclone') || a.title.toLowerCase().includes('depression'));
        const llmResult = await queryLLMWithFunctionCalling(query, {
          weather, cycloneAlerts, cycloneTrack: track.data, cycloneWind: wind.data, cycloneCone: cone.data, location: locName,
        }, history, userProfile);

        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources };
        }

        let text = `🌀 **Cyclone Tracking System**\n\n`;
        if (weather.windSpeed > 55 || cycloneAlerts.length > 0) {
          text += `🚨 **Active Tropical Disturbance Watch:**\n`;
          text += cycloneAlerts[0]?.description || `High wind velocity of ${weather.windSpeed} km/h detected near ${locName}.`;
        } else {
          text += `🟢 **No active cyclone threats** detected for ${locName}.\n`;
          text += `Current coastal wind speed: ${weather.windSpeed} km/h ${windDirection(weather.windDir)}.`;
        }
        return { type: 'text', text, source: sources };
      }

      case 'flood': {
        const [weather, basinQpf] = await Promise.all([
          getCurrentWeather(location.lat, location.lon), imdAPI.getBasinQPF(),
        ]);
        const sources = ['Open-Meteo', basinQpf.source];
        const llmResult = await queryLLMWithFunctionCalling(query, {
          weather, basinQpf: basinQpf.data, location: locName, hydroRisk: weather.humidity > 85 ? 'Elevated' : 'Normal',
        }, history, userProfile);

        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources };
        }
        return {
          type: 'text', source: sources,
          text: `🌊 **Flood Monitoring (${locName})**\n\n` +
            `• Precipitation: ${weather.description}\n` +
            `• Pressure: ${weather.pressure} hPa\n` +
            `• Risk: ${weather.humidity > 85 ? 'Elevated surface water pooling risk' : 'Normal water flow'}`,
        };
      }

      case 'climate': {
        const climateData = await getEra5ClimateTrends(location.lat, location.lon);
        const sources = ['Copernicus ERA5'];
        const llmResult = await queryLLMWithFunctionCalling(query, { climateData, location: locName }, history, userProfile);

        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources };
        }
        return {
          type: 'text', source: sources,
          text: `📊 **ERA5 Climate Insights (${locName})**\n\n${climateData.trendText || climateData.status}`,
        };
      }

      case 'agriculture': {
        const [weather, nasaData, imdRainfall, agromet] = await Promise.all([
          getCurrentWeather(location.lat, location.lon), getNasaPowerData(location.lat, location.lon),
          imdAPI.getDistrictRainfall(), imdAPI.getAgrometAdvisory(),
        ]);
        const sources = ['Open-Meteo', nasaData.source, imdRainfall.source, agromet.source];
        const llmResult = await queryLLMWithFunctionCalling(query, {
          weather, nasaData, imdRainfall: imdRainfall.data, agromet: agromet.data, location: locName,
        }, history, userProfile);

        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources };
        }

        let text = `🌾 **Agromet Advisory for ${locName}**\n\n`;
        text += `• Temp: ${weather.temp}°C | Humidity: ${weather.humidity}%\n`;
        if (weather.temp >= 38) {
          text += `⚠️ Apply light evening irrigation to protect crops against heat stress.\n`;
        } else if (weather.humidity > 80) {
          text += `⚠️ Monitor crop canopy for fungal growth due to elevated humidity.\n`;
        } else {
          text += `✅ Optimal conditions for field operations and fertilizer application.\n`;
        }
        return { type: 'text', text, source: sources };
      }

      case 'marine': {
        const [portWarning, seaBulletin, coastalBulletin, fishermenWarning, boundaries] = await Promise.all([
          imdAPI.getPortWarning(), imdAPI.getSeaBulletin(), imdAPI.getCoastalBulletin(),
          imdAPI.getFishermenWarning(), getBhuvanBoundaries('coastal'),
        ]);
        const sources = [portWarning.source, seaBulletin.source, coastalBulletin.source, fishermenWarning.source, boundaries.source];
        const llmResult = await queryLLMWithFunctionCalling(query, {
          location: locName, portWarning: portWarning.data, seaBulletin: seaBulletin.data,
          coastalBulletin: coastalBulletin.data, fishermenWarning: fishermenWarning.data, coastalBoundaries: boundaries.data,
        }, history, userProfile);
        return {
          type: 'text', source: sources,
          text: llmResult.text || `Marine bulletin data is currently ${portWarning.data || seaBulletin.data ? 'available' : 'unavailable'} for ${locName}. Please check the IMD bulletin before going to sea.`,
        };
      }

      case 'alert': {
        const gdacs = await getGdacsAlerts();
        const weather = await getCurrentWeather(location.lat, location.lon);
        const sources = ['Open-Meteo', 'GDACS SACHET Feed', 'IMD Warnings'];

        let severity = 'green';
        let alertMessage = 'No active extreme weather hazards reported for your area.';

        if (weather.temp >= 42 || weather.windSpeed > 60) {
          severity = 'red';
          alertMessage = `Extreme weather hazard active! Temp: ${weather.temp}°C, Winds: ${weather.windSpeed} km/h. Seek shelter.`;
        } else if (weather.temp >= 40 || weather.windSpeed > 40) {
          severity = 'orange';
          alertMessage = `Elevated heat/wind advisory for ${locName}. Stay hydrated and avoid outdoor exposure during peak hours.`;
        }

        const dispatchLog = await alertDispatcher.dispatchProactiveAlert({ severity, message: alertMessage });
        const llmResult = await queryLLMWithFunctionCalling(query, { weather, gdacs, severity, alertMessage, location: locName }, history, userProfile);

        let text = llmResult.text;
        if (text) {
          sources.push(llmResult.provider);
        } else {
          const statusTitle = severity === 'red' ? '🔴 SEVERE WARNING' : severity === 'orange' ? '🟠 WATCH ALERT' : '🟢 ALL CLEAR';
          text = `${statusTitle} — ${locName}\n\n${alertMessage}`;
        }
        text += `\n\n📱 Dispatched via ${dispatchLog.channels.join(', ')}`;
        return { type: 'alert', text, severity, source: sources };
      }

      default: {
        const weather = await getCurrentWeather(location.lat, location.lon);
        const forecast = await getForecast(location.lat, location.lon);
        const sources = ['Open-Meteo'];
        const llmResult = await queryLLMWithFunctionCalling(query, { weather, forecast, location: locName }, history, userProfile);

        if (llmResult.text) {
          sources.push(llmResult.provider);
          return { type: 'text', text: llmResult.text, source: sources, location, weather };
        }

        return {
          type: 'text', source: sources, location, weather,
          text: `Currently ${weather.temp}°C in ${locName} (${weather.description}). Ask me anything about weather, forecasts, crop advisories, or disaster alerts!`,
        };
      }
    }
  } catch (err) {
    return {
      type: 'text',
      text: `An error occurred while processing your question: ${err.message}`,
      source: ['Error — no APIs reached'],
    };
  }
}
