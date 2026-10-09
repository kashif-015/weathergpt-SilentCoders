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

// 15-day forecast
export async function getForecast(lat, lon) {
  const key = `forecast16:${lat},${lon}`;
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

// Browser geolocation with automatic multi-tier fallback
// Helper to get previously stored location synchronously
export function getStoredLocation() {
  try {
    const stored = localStorage.getItem('weathergpt_last_location');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.lat && parsed?.lon) return parsed;
    }
  } catch {}
  return null;
}

// Listen for browser geolocation permission changes
export function onLocationPermissionChange(callback) {
  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    let active = true;
    navigator.permissions.query({ name: 'geolocation' })
      .then(status => {
        if (!active) return;
        status.onchange = () => {
          if (active) callback(status.state);
        };
      })
      .catch(() => {});
    return () => { active = false; };
  }
  return () => {};
}

// Browser geolocation with automatic multi-tier fallback
export async function getUserLocation(forceRefresh = false) {
  const saveLocation = (loc) => {
    try {
      localStorage.setItem('weathergpt_last_location', JSON.stringify({ ...loc, savedAt: Date.now() }));
    } catch {}
    return loc;
  };

  // If not forcing refresh, check if we have a recent VERIFIED GPS location (< 15 mins)
  if (!forceRefresh) {
    try {
      const stored = localStorage.getItem('weathergpt_last_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        // Only trust recent GPS cache. Never let stale IP-based location block live GPS!
        if (parsed?.lat && parsed?.lon && parsed?.city && parsed.source === 'gps' && Date.now() - (parsed.savedAt || 0) < 15 * 60 * 1000) {
          return parsed;
        }
      }
    } catch {}
  }

  // Check permission state if supported
  let permissionState = 'prompt';
  if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
    try {
      const perm = await navigator.permissions.query({ name: 'geolocation' });
      permissionState = perm.state; // 'granted', 'prompt', or 'denied'
    } catch {}
  }

  // 1. Try Browser Geolocation (GPS / Wi-Fi positioning) unless explicitly denied
  if (typeof navigator !== 'undefined' && navigator.geolocation && permissionState !== 'denied') {
    const getPositionPromise = (timeoutMs, enableHighAccuracy) =>
      new Promise((resolve, reject) => {
        let settled = false;
        let watchId = null;

        const onDone = (pos) => {
          if (settled) return;
          settled = true;
          if (watchId !== null) {
            try { navigator.geolocation.clearWatch(watchId); } catch {}
          }
          resolve({
            lat: Number(pos.coords.latitude),
            lon: Number(pos.coords.longitude),
            accuracy: pos.coords.accuracy,
            source: 'gps',
            isApproximate: false,
          });
        };

        const onFail = (err) => {
          if (settled) return;
          settled = true;
          if (watchId !== null) {
            try { navigator.geolocation.clearWatch(watchId); } catch {}
          }
          reject(err);
        };

        // Standard getCurrentPosition
        navigator.geolocation.getCurrentPosition(onDone, onFail, {
          enableHighAccuracy,
          timeout: timeoutMs,
          maximumAge: 15000,
        });

        // Parallel watchPosition catches the quickest satellite/Wi-Fi lock
        try {
          watchId = navigator.geolocation.watchPosition(
            (pos) => {
              if (pos?.coords?.latitude && pos?.coords?.longitude) {
                onDone(pos);
              }
            },
            () => {},
            { enableHighAccuracy, timeout: timeoutMs, maximumAge: 15000 }
          );
        } catch {}
      });

    try {
      // Responsive timeouts: avoid long freezing on devices without dedicated GPS hardware
      const initialTimeout = permissionState === 'prompt' ? 8000 : 5000;
      let gpsPos;

      try {
        // High accuracy attempt first
        gpsPos = await getPositionPromise(initialTimeout, true);
      } catch (highAccErr) {
        // If high accuracy times out (common on Windows without dedicated GPS chip),
        // fallback to network/cell/Wi-Fi triangulation which resolves instantly!
        console.warn('[Location] High-accuracy GPS timed out/failed, trying standard network positioning:', highAccErr.message || highAccErr);
        gpsPos = await getPositionPromise(4000, false);
      }

      if (gpsPos?.lat && gpsPos?.lon) {
        // Reverse geocode to find exact city, town or locality
        const geo = await reverseGeocode(gpsPos.lat, gpsPos.lon).catch(() => ({}));
        const resolved = {
          lat: gpsPos.lat,
          lon: gpsPos.lon,
          accuracy: gpsPos.accuracy,
          city: geo.city || geo.name || 'Live Location',
          state: geo.state || '',
          country: geo.country || 'India',
          name: geo.city || geo.name || 'Live Location',
          source: 'gps',
          isApproximate: false,
        };
        return saveLocation(resolved);
      }
    } catch (gpsError) {
      console.warn('[Location] Browser Geolocation unavailable, falling back to IP/server detection:', gpsError.message || gpsError);
    }
  }

  // 2. Client-side BigDataCloud IP Geolocation (Zero rate-limit, high accuracy, bypasses CORS)
  try {
    const bdcRes = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client', {
      signal: AbortSignal.timeout(5000)
    });
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      if (bdcData.latitude && bdcData.longitude) {
        const cityName = bdcData.city || bdcData.locality || bdcData.principalSubdivision || 'Current Location';
        const resolved = {
          lat: Number(bdcData.latitude),
          lon: Number(bdcData.longitude),
          city: cityName,
          state: bdcData.principalSubdivision || '',
          country: bdcData.countryName || 'India',
          name: cityName,
          source: 'ip',
          isApproximate: true,
        };
        return saveLocation(resolved);
      }
    }
  } catch (bdcErr) {
    console.warn('[Location] BigDataCloud IP lookup failed:', bdcErr.message);
  }

  // 3. Backend Server Detection (/api/location/detect) — never blocked by adblockers
  try {
    const srvRes = await fetch(`${API_BASE}/location/detect`, {
      signal: AbortSignal.timeout(5000)
    });
    if (srvRes.ok) {
      const srvData = await srvRes.json();
      if (srvData?.data?.lat && srvData?.data?.lon) {
        const d = srvData.data;
        const resolved = {
          lat: Number(d.lat),
          lon: Number(d.lon),
          city: d.city || d.name || 'Current City',
          state: d.state || '',
          country: d.country || 'India',
          name: d.name || d.city || 'Current City',
          source: 'server-ip',
          isApproximate: true,
        };
        return saveLocation(resolved);
      }
    }
  } catch (srvErr) {
    console.warn('[Location] Server location detection failed:', srvErr.message);
  }

  // 4. IP Geolocation via ipwho.is
  try {
    const ipRes = await fetch('https://ipwho.is/', { signal: AbortSignal.timeout(5000) });
    if (ipRes.ok) {
      const ipData = await ipRes.json();
      if (ipData.success && ipData.latitude && ipData.longitude) {
        const resolved = {
          lat: Number(ipData.latitude),
          lon: Number(ipData.longitude),
          city: ipData.city || ipData.region,
          state: ipData.region || '',
          country: ipData.country || 'India',
          name: ipData.city || ipData.region,
          source: 'ip',
          isApproximate: true,
        };
        return saveLocation(resolved);
      }
    }
  } catch (ipErr) {
    console.warn('[Location] ipwho.is failed:', ipErr.message);
  }

  // 5. Check any previously saved location in localStorage
  try {
    const prev = localStorage.getItem('weathergpt_last_location');
    if (prev) {
      const parsed = JSON.parse(prev);
      if (parsed?.lat && parsed?.lon) return parsed;
    }
  } catch {}

  // 6. Default fallback
  return {
    lat: 21.1915,
    lon: 81.2762,
    city: 'Durg',
    state: 'Chhattisgarh',
    country: 'India',
    name: 'Durg',
    source: 'fallback',
    isApproximate: true,
  };
}

// Reverse geocode with robust fallback chain
export async function reverseGeocode(lat, lon) {
  const key = `rgeo:${Number(lat).toFixed(3)},${Number(lon).toFixed(3)}`;
  const cached = getCached(key);
  if (cached) return cached;

  // 1. Client-side BigDataCloud reverse geocode (fastest, unthrottled, highly accurate for cities & localities)
  try {
    const bdcRes = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (bdcRes.ok) {
      const bdcData = await bdcRes.json();
      const cityName = bdcData.city || bdcData.locality || bdcData.principalSubdivision || 'Current Location';
      const result = {
        city: cityName,
        state: bdcData.principalSubdivision || '',
        country: bdcData.countryName || 'India',
      };
      setCache(key, result);
      return result;
    }
  } catch (bdcErr) {
    console.warn('[Location] BigDataCloud reverse geocode failed, falling back to server geocode:', bdcErr.message);
  }

  // 2. Try backend geocode endpoint (OpenStreetMap Nominatim + server BigDataCloud)
  try {
    const res = await fetch(`${API_BASE}/geocode?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, {
      signal: AbortSignal.timeout(6000)
    });
    if (res.ok) {
      const data = await readApiJson(res);
      if (data?.data?.name && data.data.name !== 'Unknown') {
        const result = {
          city: data.data.name,
          state: data.data.state || '',
          country: data.data.country || 'India',
        };
        setCache(key, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('[Location] Backend reverse geocode failed:', err.message);
  }

  // 3. Fallback
  return {
    city: 'Current Location',
    state: '',
    country: 'India',
  };
}
