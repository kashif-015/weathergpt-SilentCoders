import 'dotenv/config';
import cors from 'cors';
import express from 'express';

console.log('[SERVER] Environment loaded. OPENAI_API_KEY:', process.env.OPENAI_API_KEY ? '✓' : '✗', 'VITE_OPENAI_API_KEY:', process.env.VITE_OPENAI_API_KEY ? '✓' : '✗', 'GEMINI_API_KEY:', process.env.GEMINI_API_KEY ? '✓' : '✗', 'VITE_GEMINI_API_KEY:', process.env.VITE_GEMINI_API_KEY ? '✓' : '✗');

const app = express();
const cache = new Map();
const inFlight = new Map();
const IMD_BASE = (process.env.IMD_API_BASE_URL || process.env.VITE_IMD_API_BASE_URL || 'https://api.imd.gov.in/api/v1').replace(/\/$/, '');
// Keep the IMD credential on the server. VITE_IMD_API_KEY remains a fallback
// for existing local .env files, but new deployments should use IMD_API_KEY.
const IMD_API_KEY = process.env.IMD_API_KEY || process.env.VITE_IMD_API_KEY || '';

app.use(cors({ origin: process.env.APP_ORIGIN || true }));
app.use(express.json({ limit: '64kb' }));

function cached(key, ttl, loader) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.timestamp < ttl) return Promise.resolve({ ...hit.value, status: 'cached' });
  if (inFlight.has(key)) return inFlight.get(key);
  const request = loader().then((value) => {
    cache.set(key, { value, timestamp: Date.now() });
    return value;
  }).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

async function requestJson(url, options = {}, attempts = 2) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      if (response.status === 429) throw new Error('Upstream rate limit reached');
      if (!response.ok) throw new Error(`Upstream HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts && !String(error.message).includes('rate limit')) {
        await new Promise((resolve) => setTimeout(resolve, 300 * 2 ** attempt));
      }
    } finally { clearTimeout(timer); }
  }
  throw lastError;
}

function envelope(source, status, data, extra = {}) {
  return { source, status, timestamp: new Date().toISOString(), data, ...extra };
}

app.get('/api/geocode', async (req, res) => {
  const { lat, lon } = req.query;
  if (lat && lon) {
    try {
      const result = await cached(`reverse:${lat}:${lon}`, 24 * 60 * 60 * 1000, async () => {
        try {
          const data = await requestJson(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, { headers: { 'User-Agent': 'WeatherGPT/1.0 contact@weathergpt.app' } });
          const address = data.address || {};
          const name = address.city || address.town || address.village || address.suburb || address.municipality || address.county || address.state_district || address.district || address.state || 'Unknown';
          if (name !== 'Unknown') {
            return envelope('OpenStreetMap Nominatim', 'live', { name, country: address.country || '', state: address.state || '', lat: Number(lat), lon: Number(lon) });
          }
        } catch (nomErr) {
          console.warn('Nominatim reverse geocode failed, falling back:', nomErr.message);
        }

        // Fast, reliable BigDataCloud fallback on server
        const bdc = await requestJson(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}&localityLanguage=en`);
        const name = bdc.city || bdc.locality || bdc.principalSubdivision || 'Unknown';
        return envelope('BigDataCloud', 'live', { name, country: bdc.countryName || '', state: bdc.principalSubdivision || '', lat: Number(lat), lon: Number(lon) });
      });
      return res.json(result);
    } catch { return res.status(404).json({ error: 'Location could not be resolved.' }); }
  }
  const name = String(req.query.name || '').trim();
  if (!name || name.length > 100) return res.status(400).json({ error: 'A valid place name is required.' });
  try {
    const result = await cached(`geocode:${name.toLowerCase()}`, 24 * 60 * 60 * 1000, async () => {
      const data = await requestJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(name)}`, { headers: { 'User-Agent': 'WeatherGPT/1.0 contact@weathergpt.app' } });
      const place = data[0];
      if (!place) throw new Error('Location not found');
      return envelope('OpenStreetMap Nominatim', 'live', { name: place.name || place.display_name.split(',')[0], lat: Number(place.lat), lon: Number(place.lon), country: place.address?.country || '', displayName: place.display_name });
    });
    res.json(result);
  } catch (error) { res.status(404).json({ error: 'Location could not be resolved.' }); }
});

app.get('/api/weather/current', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });
  try {
    const result = await cached(`current:${lat}:${lon}`, 5 * 60 * 1000, async () => {
      const params = new URLSearchParams({ latitude: lat, longitude: lon, current: 'temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure', timezone: 'auto' });
      const data = await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`);
      return envelope('Open-Meteo', 'fallback', data.current);
    });
    res.json(result);
  } catch { res.status(503).json(envelope('Open-Meteo', 'unavailable', null)); }
});

app.get('/api/weather/forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });
  try {
    const result = await cached(`forecast:${lat}:${lon}`, 15 * 60 * 1000, async () => {
      const params = new URLSearchParams({ latitude: lat, longitude: lon, daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max', timezone: 'auto', forecast_days: '7' });
      return envelope('Open-Meteo', 'fallback', (await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`)).daily);
    });
    res.json(result);
  } catch { res.status(503).json(envelope('Open-Meteo', 'unavailable', null)); }
});

// Historical weather is intentionally kept separate from the current-weather
// and forecast routes. The archive API returns daily observations for the
// requested local date at the supplied coordinates.
app.get('/api/weather/historical', async (req, res) => {
  const { lat, lon, date } = req.query;
  const latitude = Number(lat);
  const longitude = Number(lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return res.status(400).json({ error: 'Valid lat and lon are required.' });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ''))) {
    return res.status(400).json({ error: 'date must use YYYY-MM-DD.' });
  }

  const requestedDate = new Date(`${date}T00:00:00Z`);
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (Number.isNaN(requestedDate.getTime()) || requestedDate.toISOString().slice(0, 10) !== date || requestedDate >= today) {
    return res.status(400).json({ error: 'A valid past date is required for historical weather.' });
  }

  try {
    const result = await cached(`historical:${latitude}:${longitude}:${date}`, 24 * 60 * 60 * 1000, async () => {
      const params = new URLSearchParams({
        latitude: String(latitude),
        longitude: String(longitude),
        start_date: date,
        end_date: date,
        daily: 'temperature_2m_max,temperature_2m_min,temperature_2m_mean,rain_sum,precipitation_sum,precipitation_hours,weather_code',
        timezone: 'auto',
      });
      const raw = await requestJson(`https://archive-api.open-meteo.com/v1/archive?${params}`);
      const daily = raw.daily || {};
      const index = daily.time?.indexOf(date) ?? -1;
      if (index < 0) throw new Error('Historical weather data is unavailable for that date.');

      const value = (field) => daily[field]?.[index] ?? null;
      const rainSum = value('rain_sum');
      return envelope('Open-Meteo Historical Weather API', 'live', {
        date,
        temperature: {
          max: value('temperature_2m_max'),
          min: value('temperature_2m_min'),
          mean: value('temperature_2m_mean'),
        },
        rainSum,
        precipitation: value('precipitation_sum'),
        precipitationHours: value('precipitation_hours'),
        weatherCode: value('weather_code'),
        didRain: Number(rainSum) > 0,
      });
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message || 'Historical weather is unavailable.' });
  }
});

// ERA5 climate insights use annual means and totals derived from daily
// reanalysis data. Cache each grid point for a day; ERA5 is updated daily.
app.get('/api/climate/trends', async (req, res) => {
  const latitude = Number(req.query.lat);
  const longitude = Number(req.query.lon);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
    return res.status(400).json({ error: 'Valid lat and lon are required.' });
  }

  const lat = latitude.toFixed(3);
  const lon = longitude.toFixed(3);
  const endYear = new Date().getUTCFullYear() - 1;
  const startDate = '1991-01-01';
  const endDate = `${endYear}-12-31`;
  try {
    const result = await cached(`climate:era5:${lat}:${lon}`, 24 * 60 * 60 * 1000, async () => {
      const params = new URLSearchParams({
        latitude: lat,
        longitude: lon,
        start_date: startDate,
        end_date: endDate,
        daily: 'temperature_2m_mean,precipitation_sum',
        timezone: 'UTC',
        models: 'era5',
      });
      const raw = await requestJson(`https://archive-api.open-meteo.com/v1/archive?${params}`);
      const daily = raw.daily || {};
      const years = new Map();
      (daily.time || []).forEach((date, index) => {
        const year = Number(String(date).slice(0, 4));
        const temperature = Number(daily.temperature_2m_mean?.[index]);
        const precipitation = Number(daily.precipitation_sum?.[index]);
        if (!Number.isInteger(year)) return;
        const stats = years.get(year) || { year, temperatureTotal: 0, temperatureDays: 0, precipitationTotal: 0, precipitationDays: 0 };
        if (Number.isFinite(temperature)) { stats.temperatureTotal += temperature; stats.temperatureDays += 1; }
        if (Number.isFinite(precipitation)) { stats.precipitationTotal += precipitation; stats.precipitationDays += 1; }
        years.set(year, stats);
      });
      const series = [...years.values()]
        .filter((year) => year.temperatureDays >= 350 && year.precipitationDays >= 350)
        .map((year) => ({
          year: year.year,
          meanTemperature: Number((year.temperatureTotal / year.temperatureDays).toFixed(2)),
          precipitation: Number(year.precipitationTotal.toFixed(1)),
        }))
        .sort((a, b) => a.year - b.year);
      if (series.length < 20) throw new Error('ERA5 climate history is incomplete for this location.');

      const average = (points, key) => points.length ? points.reduce((sum, point) => sum + point[key], 0) / points.length : null;
      const firstDecade = series.filter((point) => point.year >= 1991 && point.year <= 2000);
      const recentDecade = series.filter((point) => point.year >= endYear - 9 && point.year <= endYear);
      const tempX = series.map((point) => point.year);
      const tempY = series.map((point) => point.meanTemperature);
      const xMean = average(series, 'year');
      const yMean = average(series, 'meanTemperature');
      const denominator = tempX.reduce((sum, year) => sum + ((year - xMean) ** 2), 0);
      const slopePerDecade = denominator ? (tempX.reduce((sum, year, index) => sum + (year - xMean) * (tempY[index] - yMean), 0) / denominator) * 10 : 0;
      const firstRain = average(firstDecade, 'precipitation');
      const recentRain = average(recentDecade, 'precipitation');
      return envelope('ERA5 reanalysis via Open-Meteo', 'live', {
        latitude: Number(lat), longitude: Number(lon),
        period: { start: series[0].year, end: series.at(-1).year },
        series,
        temperatureTrendCPerDecade: Number(slopePerDecade.toFixed(2)),
        temperatureChangeC: Number((average(recentDecade, 'meanTemperature') - average(firstDecade, 'meanTemperature')).toFixed(2)),
        precipitationChangePercent: firstRain ? Number((((recentRain - firstRain) / firstRain) * 100).toFixed(1)) : null,
        baselinePeriod: { start: 1991, end: 2000, meanTemperature: Number(average(firstDecade, 'meanTemperature')?.toFixed(2)), precipitation: Number(firstRain?.toFixed(1)) },
        recentPeriod: { start: endYear - 9, end: endYear, meanTemperature: Number(average(recentDecade, 'meanTemperature')?.toFixed(2)), precipitation: Number(recentRain?.toFixed(1)) },
      });
    });
    res.json(result);
  } catch (error) {
    res.status(503).json({ error: error.message || 'ERA5 climate data is temporarily unavailable.' });
  }
});

// Phase 2 dashboard endpoints.  Open-Meteo supplies point observations that
// IMD does not publish consistently (visibility, apparent temperature, hourly
// rain probability).  The response keeps the source beside every field so a
// future IMD station mapping can replace individual values without changing
// the UI contract.
const compass = (degrees) => ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'][Math.round(Number(degrees || 0) / 22.5) % 16];
const wmo = (code) => ({
  0: ['Clear sky', '☀️'], 1: ['Mainly clear', '🌤️'], 2: ['Partly cloudy', '⛅'], 3: ['Overcast', '☁️'],
  45: ['Foggy', '🌫️'], 48: ['Rime fog', '🌫️'], 51: ['Light drizzle', '🌦️'], 53: ['Drizzle', '🌦️'], 55: ['Dense drizzle', '🌧️'],
  61: ['Light rain', '🌧️'], 63: ['Rain', '🌧️'], 65: ['Heavy rain', '🌧️'], 80: ['Rain showers', '🌦️'], 81: ['Rain showers', '🌧️'], 82: ['Violent showers', '⛈️'],
  95: ['Thunderstorm', '⛈️'], 96: ['Thunderstorm with hail', '⛈️'], 99: ['Severe thunderstorm', '⛈️'],
}[code] || ['Unknown', '🌡️']);

app.get('/api/dashboard/current', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });
  try {
    const result = await cached(`dashboard:${lat}:${lon}`, 10 * 60 * 1000, async () => {
      const params = new URLSearchParams({ latitude: lat, longitude: lon, timezone: 'auto', current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure', hourly: 'visibility,surface_pressure', daily: 'sunrise,sunset' });
      const data = await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`);
      const current = data.current || {}; const hourly = data.hourly || {}; const daily = data.daily || {};
      const nowIndex = Math.max(0, hourly.time?.findIndex((time) => time >= current.time) || 0);
      const priorIndex = Math.max(0, nowIndex - 3);
      const pressureDelta = Number(hourly.surface_pressure?.[nowIndex] || current.surface_pressure) - Number(hourly.surface_pressure?.[priorIndex] || current.surface_pressure);
      const [condition, icon] = wmo(current.weather_code);
      const field = (value, unit, source = 'Open-Meteo') => ({ value, unit, source });
      return envelope('IMD + Open-Meteo', 'live', {
        condition: { label: condition, icon, code: current.weather_code, source: 'Open-Meteo' },
        temperature: field(current.temperature_2m, '°C'), feelsLike: field(current.apparent_temperature, '°C'),
        humidity: field(current.relative_humidity_2m, '%'), windSpeed: field(current.wind_speed_10m, 'km/h'),
        windDirection: { ...field(current.wind_direction_10m, '°'), compass: compass(current.wind_direction_10m) },
        rainfall: field(current.precipitation ?? 0, 'mm'), visibility: field(Math.round((hourly.visibility?.[nowIndex] || 0) / 100) / 10, 'km'),
        pressure: { ...field(current.surface_pressure, 'hPa'), trend: pressureDelta > 0.5 ? 'rising' : pressureDelta < -0.5 ? 'falling' : 'steady' },
        sun: { sunrise: daily.sunrise?.[0] || null, sunset: daily.sunset?.[0] || null, source: 'Open-Meteo' },
        observedAt: current.time,
      });
    });
    res.json(result);
  } catch { res.status(503).json(envelope('Open-Meteo', 'unavailable', null)); }
});

app.get('/api/forecast', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });
  try {
    const result = await cached(`phase2forecast:${lat}:${lon}`, 60 * 60 * 1000, async () => {
      const params = new URLSearchParams({ latitude: lat, longitude: lon, timezone: 'auto', forecast_days: '7', current: 'temperature_2m', hourly: 'temperature_2m,weather_code,precipitation_probability,wind_speed_10m,wind_direction_10m', daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max' });
      const raw = await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`); const hourly = raw.hourly || {}; const daily = raw.daily || {};
      const currentHourIndex = Math.max(0, (hourly.time || []).findIndex((time) => time >= raw.current?.time));
      const hours = (hourly.time || []).slice(currentHourIndex, currentHourIndex + 24).map((time, i) => { const sourceIndex = currentHourIndex + i; const [label, icon] = wmo(hourly.weather_code?.[sourceIndex]); return { time, temp: Math.round(hourly.temperature_2m?.[sourceIndex]), icon, label, rainProbability: hourly.precipitation_probability?.[sourceIndex] ?? 0, windSpeed: Math.round(hourly.wind_speed_10m?.[sourceIndex]), windDirection: hourly.wind_direction_10m?.[sourceIndex], windCompass: compass(hourly.wind_direction_10m?.[sourceIndex]) }; });
      const days = (daily.time || []).map((date, i) => { const [label, icon] = wmo(daily.weather_code?.[i]); return { date, icon, label, maxTemp: Math.round(daily.temperature_2m_max?.[i]), minTemp: Math.round(daily.temperature_2m_min?.[i]), rainProbability: daily.precipitation_probability_max?.[i] ?? 0, source: 'Open-Meteo' }; });
      return envelope('IMD + Open-Meteo', 'live', { hourly: hours, daily: days, sources: { hourly: 'Open-Meteo', daily: 'Open-Meteo fallback (IMD city mapping not available)' } });
    });
    res.json(result);
  } catch { res.status(503).json(envelope('Open-Meteo', 'unavailable', null)); }
});

app.get('/api/alerts/active', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });
  try {
    const result = await cached(`phase2alerts:${lat}:${lon}`, 10 * 60 * 1000, async () => {
      const params = new URLSearchParams({ latitude: lat, longitude: lon, current: 'wind_speed_10m,weather_code', daily: 'precipitation_sum,temperature_2m_max', timezone: 'auto' });
      const data = await requestJson(`https://api.open-meteo.com/v1/forecast?${params}`); const alerts = [];
      const rain = Number(data.daily?.precipitation_sum?.[0] || 0), wind = Number(data.current?.wind_speed_10m || 0), heat = Number(data.daily?.temperature_2m_max?.[0] || 0), code = data.current?.weather_code;
      if (rain >= 50) alerts.push({ id: 'heavy-rain', hazard: 'Heavy rain', icon: '🌧️', severity: rain >= 100 ? 'red' : 'orange', summary: `${rain} mm of precipitation is forecast today. Avoid flooded routes and follow local instructions.`, source: 'Open-Meteo derived signal' });
      if (wind >= 55) alerts.push({ id: 'strong-wind', hazard: 'Strong wind', icon: '💨', severity: wind >= 75 ? 'red' : 'orange', summary: `Winds are near ${Math.round(wind)} km/h. Secure loose items and avoid exposed areas.`, source: 'Open-Meteo derived signal' });
      if (heat >= 40) alerts.push({ id: 'heatwave', hazard: 'Heat stress', icon: '🌡️', severity: heat >= 44 ? 'red' : 'yellow', summary: `High of ${Math.round(heat)}°C expected today. Hydrate and limit midday exertion.`, source: 'Open-Meteo derived signal' });
      if ([95, 96, 99].includes(code)) alerts.push({ id: 'thunderstorm', hazard: 'Thunderstorm', icon: '⛈️', severity: 'orange', summary: 'Thunderstorm conditions are currently reported. Seek sturdy shelter and avoid open areas.', source: 'Open-Meteo derived signal' });
      return envelope('IMD + Open-Meteo', 'live', { alerts, checkedAt: new Date().toISOString(), coverage: 'IMD district IDs are required for official warnings; derived signals remain visible until a district mapping is available.' });
    });
    res.json(result);
  } catch { res.status(503).json(envelope('Alerts', 'unavailable', null)); }
});

app.get('/api/imd/:endpoint', async (req, res) => {
  const endpoint = String(req.params.endpoint || '');
  const allowed = new Set(['cityforecast', 'cityforecastloc', 'current_wx', 'districtnowcast', 'stationnowcast', 'districtwarning', 'subdivisionwarning', 'districtrainfall', 'staterainfall', 'basinqpf', 'cyclone_track', 'cyclone_wind', 'cyclone_cou', 'aws_data', 'seabulletin', 'coastalbulletin', 'portwarning', 'fishermenwarning', 'agromet_advisory']);
  if (!allowed.has(endpoint)) return res.status(404).json({ error: 'Unsupported IMD endpoint.' });
  try {
    const query = new URLSearchParams(req.query).toString();
    const cacheTtl = ['districtwarning', 'cyclone_track', 'cyclone_wind', 'cyclone_cou', 'aws_data'].includes(endpoint) ? 15 * 60 * 1000 : 5 * 60 * 1000;
    const result = await cached(`imd:${endpoint}:${query}`, cacheTtl, async () => {
      const headers = IMD_API_KEY ? { 'x-api-key': IMD_API_KEY } : {};
      return envelope('IMD', 'live', await requestJson(`${IMD_BASE}/${endpoint}${query ? `?${query}` : ''}`, { headers }));
    });
    res.json(result);
  } catch { res.status(503).json(envelope('IMD', 'unavailable', null)); }
});

app.get('/api/disasters/earthquakes', async (req, res) => {
  const india = req.query.india === 'true';
  try {
    const result = await cached(`usgs:${india}`, 5 * 60 * 1000, async () => {
      const now = new Date(); const start = new Date(now - (india ? 30 : 7) * 86400000);
      const params = new URLSearchParams({ format: 'geojson', starttime: start.toISOString().slice(0, 10), endtime: now.toISOString().slice(0, 10), minmagnitude: india ? '3' : '4', orderby: 'time', limit: '20' });
      if (india) Object.assign(params, { minlatitude: '6', maxlatitude: '37', minlongitude: '68', maxlongitude: '98' });
      return envelope('USGS', 'live', (await requestJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?${params}`)).features);
    });
    res.json(result);
  } catch { res.status(503).json(envelope('USGS', 'unavailable', null)); }
});

app.get('/api/disasters/gdacs', async (req, res) => {
  try {
    const result = await cached('gdacs', 5 * 60 * 1000, async () => {
      const text = await (await fetch('https://www.gdacs.org/xml/rss.xml')).text();
      const readTag = (item, tag) => {
        const tagPattern = `(?:[\\w-]+:)?${tag}`;
        const match = item.match(new RegExp(`<${tagPattern}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/(?:[\\w-]+:)?${tag}>|<${tagPattern}>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i'));
        return (match?.[1] || match?.[2] || '').trim();
      };
      const items = [...text.matchAll(/<item>([\s\S]*?)<\/item>/gi)]
        .map(([, item]) => {
          const pubDate = readTag(item, 'pubDate');
          const updatedAt = readTag(item, 'datemodified') || pubDate;
          return {
            title: readTag(item, 'title'),
            description: readTag(item, 'description'),
            category: readTag(item, 'category') || 'Disaster',
            pubDate,
            updatedAt,
            link: readTag(item, 'link'),
          };
        })
        .sort((a, b) => {
          const aTime = Date.parse(a.updatedAt);
          const bTime = Date.parse(b.updatedAt);
          return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
        })
        .slice(0, 20);
      return envelope('GDACS', 'live', items);
    });
    res.json(result);
  } catch { res.status(503).json(envelope('GDACS', 'unavailable', null)); }
});

app.get('/api/climate/solar', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) return res.status(400).json({ error: 'lat and lon are required.' });
  try {
    const result = await cached(`nasa:${lat}:${lon}`, 60 * 60 * 1000, async () => {
      const today = new Date().toISOString().slice(0, 10).replaceAll('-', '');
      const start = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10).replaceAll('-', '');
      const params = new URLSearchParams({ parameters: 'ALLSKY_SFC_SW_DWN,T2M_MAX,T2M_MIN,RH2M,PRECTOTCORR', community: 'AG', longitude: lon, latitude: lat, start, end: today, format: 'JSON' });
      return envelope('NASA POWER', 'live', await requestJson(`https://power.larc.nasa.gov/api/temporal/daily/point?${params}`));
    });
    res.json(result);
  } catch { res.status(503).json(envelope('NASA POWER', 'unavailable', null)); }
});

app.post('/api/ai/generate', async (req, res) => {
  // Supports both Gemini and OpenAI (including NVIDIA's compatible API)
  // Priority: Try Gemini first (most reliable), fall back to OpenAI if configured
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
  const openaiBaseURL = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';
  
  console.log('[AI] Gemini Key:', geminiKey ? '✓ Set' : '✗ Not set');
  console.log('[AI] OpenAI Key:', openaiKey ? '✓ Set' : '✗ Not set');
  console.log('[AI] OpenAI Base URL:', openaiBaseURL);
  
  const { contents, generationConfig = {} } = req.body || {};
  if (!Array.isArray(contents) || contents.length === 0) return res.status(400).json({ error: 'AI contents are required.' });

  try {
    // Try Gemini first (most reliable)
    if (geminiKey) {
      console.log('[AI] Attempting Gemini request...');
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents, generationConfig })
        });

        console.log('[AI] Gemini response status:', response.status);
        const body = await response.json();
        
        if (response.status === 429) {
          console.log('[AI] Gemini rate limited, trying OpenAI...');
        } else if (!response.ok) {
          console.error('[AI] Gemini failed:', response.status, body?.error?.message);
        } else {
          const text = body.candidates?.[0]?.content?.parts?.[0]?.text || '';
          if (text) {
            console.log('[AI] Gemini success');
            return res.json({ text, provider: 'Gemini 2.5 Flash' });
          }
        }
      } catch (error) {
        console.error('[AI] Gemini error:', error.message);
      }
    }

    // Fall back to OpenAI/NVIDIA if Gemini failed/unavailable
    if (openaiKey) {
      console.log('[AI] Attempting OpenAI request...');
      try {
        // Convert Gemini format to OpenAI format
        const messages = contents.map(item => ({
          role: item.role === 'model' ? 'assistant' : 'user',
          content: item.parts?.map(p => p.text).join('\n') || ''
        }));

        const response = await fetch(`${openaiBaseURL}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages,
            temperature: generationConfig.temperature || 0.7,
            max_tokens: 2048
          })
        });

        console.log('[AI] OpenAI response status:', response.status);
        const text = await response.text();
        console.log('[AI] OpenAI response:', text.slice(0, 200));
        
        let body;
        try {
          body = JSON.parse(text);
        } catch (e) {
          console.error('[AI] OpenAI response parse error:', e.message);
          throw new Error('Invalid OpenAI response');
        }
        
        if (response.status === 429) {
          console.log('[AI] OpenAI rate limited');
          return res.json({ text: '', provider: 'OpenAI', rateLimited: true });
        }
        
        if (!response.ok) {
          console.error('[AI] OpenAI failed:', response.status, body?.error?.message);
          throw new Error(body?.error?.message || 'OpenAI request failed');
        }
        
        const resultText = body.choices?.[0]?.message?.content || '';
        if (resultText) {
          console.log('[AI] OpenAI success');
          return res.json({ text: resultText, provider: 'OpenAI' });
        }
      } catch (error) {
        console.error('[AI] OpenAI exception:', error.message);
      }
    }

    // All AI services failed
    console.error('[AI] All AI services failed or unconfigured');
    return res.status(503).json({ 
      error: 'AI services are currently unavailable. Please try again in a moment.',
      providers: { gemini: !!geminiKey, openai: !!openaiKey }
    });
  } catch (error) {
    console.error('[AI] Unexpected exception:', error.message);
    res.status(502).json({ error: 'AI service error: ' + error.message });
  }
});

app.post('/api/voice/synthesize', async (req, res) => {
  if (!process.env.SARVAM_API_KEY) return res.status(503).json({ error: 'Sarvam voice is not configured.' });
  const { text, language_code = 'en-IN' } = req.body || {};
  if (!text?.trim()) return res.status(400).json({ error: 'Text is required.' });
  try {
    const response = await fetch('https://api.sarvam.ai/text-to-speech', { method: 'POST', headers: { 'api-subscription-key': process.env.SARVAM_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ text: text.slice(0, 2500), language_code, model: 'bulbul:v3', speaker: 'shubh', output_audio_codec: 'wav' }) });
    const body = await response.json();
    if (!response.ok) return res.status(response.status).json({ error: body.message || 'Sarvam synthesis failed.' });
    res.json({ audio: body.audios?.join('') || '' });
  } catch { res.status(502).json({ error: 'Sarvam text-to-speech is unavailable.' }); }
});

export default app;
