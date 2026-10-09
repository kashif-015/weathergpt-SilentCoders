/* WeatherGPT — Weather & Disaster Data Services */

const API_BASE = '/api';

// In-memory cache
const cache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  return null;
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() });
}

async function readApiJson(response) {
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json') ? await response.json() : null;
  if (!response.ok) throw new Error(body?.error || `Weather service is unavailable (HTTP ${response.status}).`);
  return body;
}

// Geocoding
export async function geocodeCity(name) {
  const key = `geo:${name.toLowerCase()}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/geocode?name=${encodeURIComponent(name)}`);
  const response = await readApiJson(res);
  if (!res.ok || !response.data) throw new Error(`Location "${name}" not found`);
  const result = response.data;
  const location = {
    name: result.name,
    lat: result.lat,
    lon: result.lon,
    country: result.country,
    admin1: result.admin1 || '',
  };
  setCache(key, location);
  return location;
}

// Weather code to description & emoji
const WMO_CODES = {
  0: { desc: 'Clear sky', icon: '☀️' },
  1: { desc: 'Mainly clear', icon: '🌤️' },
  2: { desc: 'Partly cloudy', icon: '⛅' },
  3: { desc: 'Overcast', icon: '☁️' },
  45: { desc: 'Foggy', icon: '🌫️' },
  48: { desc: 'Depositing rime fog', icon: '🌫️' },
  51: { desc: 'Light drizzle', icon: '🌦️' },
  53: { desc: 'Moderate drizzle', icon: '🌦️' },
  55: { desc: 'Dense drizzle', icon: '🌧️' },
  61: { desc: 'Slight rain', icon: '🌧️' },
  63: { desc: 'Moderate rain', icon: '🌧️' },
  65: { desc: 'Heavy rain', icon: '🌧️' },
  71: { desc: 'Slight snow', icon: '🌨️' },
  73: { desc: 'Moderate snow', icon: '🌨️' },
  75: { desc: 'Heavy snow', icon: '❄️' },
  80: { desc: 'Slight rain showers', icon: '🌦️' },
  81: { desc: 'Moderate rain showers', icon: '🌧️' },
  82: { desc: 'Violent rain showers', icon: '⛈️' },
  85: { desc: 'Slight snow showers', icon: '🌨️' },
  86: { desc: 'Heavy snow showers', icon: '❄️' },
  95: { desc: 'Thunderstorm', icon: '⛈️' },
  96: { desc: 'Thunderstorm with hail', icon: '⛈️' },
  99: { desc: 'Thunderstorm with heavy hail', icon: '⛈️' },
};

export function getWeatherInfo(code) {
  return WMO_CODES[code] || { desc: 'Unknown', icon: '🌡️' };
}

// Current weather
export async function getCurrentWeather(lat, lon) {
  const key = `current:${lat},${lon}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/weather/current?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  const response = await readApiJson(res);
  if (!res.ok || !response.data) throw new Error('Current weather is unavailable.');
  const c = response.data;
  const info = getWeatherInfo(c.weather_code);

  const result = {
    temp: Math.round(c.temperature_2m),
    feelsLike: Math.round(c.apparent_temperature),
    humidity: c.relative_humidity_2m,
    windSpeed: Math.round(c.wind_speed_10m),
    windDir: c.wind_direction_10m,
    pressure: Math.round(c.surface_pressure),
    description: info.desc,
    icon: info.icon,
    time: c.time,
    weatherCode: c.weather_code,
  };
  setCache(key, result);
  return result;
}

// 7-day forecast
export async function getForecast(lat, lon) {
  const key = `forecast:${lat},${lon}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/weather/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`);
  const response = await readApiJson(res);
  if (!res.ok || !response.data) throw new Error('Forecast is unavailable.');
  const d = response.data;

  const days = d.time.map((date, i) => {
    const info = getWeatherInfo(d.weather_code[i]);
    return {
      date,
      dayName: new Date(date).toLocaleDateString('en', { weekday: 'short' }),
      maxTemp: Math.round(d.temperature_2m_max[i]),
      minTemp: Math.round(d.temperature_2m_min[i]),
      precipitation: d.precipitation_sum[i],
      windMax: Math.round(d.wind_speed_10m_max[i]),
      description: info.desc,
      icon: info.icon,
    };
  });

  setCache(key, days);
  return days;
}

// Historical daily observations from the Open-Meteo archive API. This is
// separate from current conditions and forecast data by design.
export async function getHistoricalWeather(lat, lon, date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
    throw new Error('A historical date in YYYY-MM-DD format is required.');
  }
  const key = `historical:${lat},${lon},${date}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/weather/historical?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&date=${encodeURIComponent(date)}`);
  const response = await readApiJson(res);
  if (!response.data) throw new Error('Historical weather is unavailable.');
  const data = response.data;
  const info = getWeatherInfo(data.weatherCode);
  const result = {
    date: data.date,
    maxTemp: data.temperature?.max ?? null,
    minTemp: data.temperature?.min ?? null,
    meanTemp: data.temperature?.mean ?? null,
    rainSum: data.rainSum ?? null,
    precipitation: data.precipitation ?? null,
    precipitationHours: data.precipitationHours ?? null,
    weatherCode: data.weatherCode ?? null,
    didRain: Number(data.rainSum) > 0,
    description: info.desc,
    icon: info.icon,
  };
  setCache(key, result);
  return result;
}

// USGS Earthquakes
export async function getRecentEarthquakes(minMag = 4.0) {
  const key = `quakes:${minMag}`;
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/disasters/earthquakes?india=false&minMagnitude=${encodeURIComponent(minMag)}`);
  const response = await readApiJson(res);
  if (!res.ok || !response.data) throw new Error('Earthquake feed is unavailable.');
  const quakes = response.data.map(f => ({
    id: f.id,
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: new Date(f.properties.time).toLocaleString(),
    depth: f.geometry.coordinates[2],
    lat: f.geometry.coordinates[1],
    lon: f.geometry.coordinates[0],
    url: f.properties.url,
    severity: f.properties.mag >= 7 ? 'severe' : f.properties.mag >= 6 ? 'strong' : f.properties.mag >= 5 ? 'moderate' : 'minor',
  }));

  setCache(key, quakes);
  return quakes;
}

// Indian-region earthquakes
export async function getIndiaEarthquakes() {
  const key = 'quakes:india';
  const cached = getCached(key);
  if (cached) return cached;

  const res = await fetch(`${API_BASE}/disasters/earthquakes?india=true`);
  const response = await readApiJson(res);
  if (!res.ok || !response.data) throw new Error('Earthquake feed is unavailable.');
  const quakes = response.data.map(f => ({
    id: f.id,
    magnitude: f.properties.mag,
    place: f.properties.place,
    time: new Date(f.properties.time).toLocaleString(),
    depth: f.geometry.coordinates[2],
    severity: f.properties.mag >= 7 ? 'severe' : f.properties.mag >= 6 ? 'strong' : f.properties.mag >= 5 ? 'moderate' : 'minor',
  }));

  setCache(key, quakes);
  return quakes;
}

// Browser geolocation with automatic IP fallback
export async function getUserLocation() {
  // 1. Try GPS / Browser Geolocation first
  if (typeof navigator !== 'undefined' && navigator.geolocation) {
    try {
      const gpsPos = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          pos => resolve({
            lat: pos.coords.latitude,
            lon: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            source: 'gps'
          }),
          err => reject(err),
          // Request a fresh precise fix instead of reusing a stale network position.
          { timeout: 15000, enableHighAccuracy: true, maximumAge: 0 }
        );
      });
      return gpsPos;
    } catch (gpsError) {
      console.warn('Browser GPS unavailable, falling back to IP geolocation:', gpsError.message || gpsError);
    }
  }

  // 2. IP Geolocation Fallback (free, highly reliable, fast)
  try {
    const ipRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(5000) });
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData.success && ipData.latitude && ipData.longitude) {
        return {
          lat: Number(ipData.latitude),
          lon: Number(ipData.longitude),
          city: ipData.city || ipData.region,
          state: ipData.region,
          country: ipData.country,
          name: ipData.city || ipData.region,
          source: 'ip'
        };
      }
    }
  } catch (ipErr) {
    console.warn('ipwho.is failed, trying secondary IP service:', ipErr.message);
  }

  // 3. Secondary IP Geolocation Fallback (ipapi.co)
  try {
    const res2 = await fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) });
    if (res2.ok) {
      const data2 = await res2.json();
      if (data2.latitude && data2.longitude) {
        return {
          lat: Number(data2.latitude),
          lon: Number(data2.longitude),
          city: data2.city || data2.region,
          state: data2.region,
          country: data2.country_name,
          name: data2.city || data2.region,
          source: 'ip'
        };
      }
    }
  } catch (err2) {
    console.warn('Secondary IP service failed:', err2.message);
  }

  // 4. Default fallback if all offline
  return {
    lat: 21.7345,
    lon: 81.9471,
    city: 'Bhatapara',
    state: 'Chhattisgarh',
    country: 'India',
    name: 'Bhatapara',
    source: 'fallback'
  };
}

// Reverse geocode with robust fallback chain
export async function reverseGeocode(lat, lon) {
  const key = `rgeo:${Number(lat).toFixed(2)},${Number(lon).toFixed(2)}`;
  const cached = getCached(key);
  if (cached) return cached;

  // 1. Try backend geocode endpoint
  try {
    const res = await fetch(`${API_BASE}/geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data = await readApiJson(res);
      if (data?.data?.name && data.data.name !== 'Unknown') {
        const result = {
          city: data.data.name,
          state: data.data.state || '',
          country: data.data.country || '',
        };
        setCache(key, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('Backend reverse geocode failed, trying client fallback:', err.message);
  }

  // 2. Client-side BigDataCloud reverse geocode (unlimited, zero-key, high accuracy)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const cityName = bdcData.city || bdcData.locality || bdcData.principalSubdivision || 'Current Location';
      const result = {
        city: cityName,
        state: bdcData.principalSubdivision || '',
        country: bdcData.countryName || '',
      };
      setCache(key, result);
      return result;
    }
  } catch (bdcErr) {
    console.warn('BigDataCloud reverse geocode failed:', bdcErr.message);
  }

  // 3. Fallback
  return {
    city: 'Current Location',
    state: '',
    country: '',
  };
}
