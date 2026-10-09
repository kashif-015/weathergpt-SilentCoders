const cache = new Map();

async function get(path, key) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < cached.ttl) return cached.value;
  const response = await fetch(path);
  const body = await response.json();
  if (!response.ok || !body.data) throw new Error(body.error || 'Weather dashboard is unavailable.');
  const ttl = key.startsWith('forecast') ? 60 * 60_000 : 10 * 60_000;
  cache.set(key, { value: body.data, at: Date.now(), ttl });
  return body.data;
}

export const getDashboard = (lat, lon) => get(`/api/dashboard/current?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, `dashboard:${lat}:${lon}`);
export const getDashboardForecast = (lat, lon) => get(`/api/forecast?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, `forecast:${lat}:${lon}`);
export const getActiveAlerts = (lat, lon) => get(`/api/alerts/active?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`, `alerts:${lat}:${lon}`);
