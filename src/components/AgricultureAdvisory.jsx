import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CloudRain, Droplets, LoaderCircle, MapPin, RefreshCw, Sprout, Sun, Thermometer, Wind } from 'lucide-react';
import { getCurrentWeather, getForecast } from '../services/weatherService.js';
import { getNasaPowerData } from '../services/apiClients.js';

const CROPS = ['Rice', 'Wheat', 'Maize', 'Cotton', 'Soybean', 'Pulses', 'Vegetables', 'Other'];
const STAGES = ['Land preparation', 'Sowing / transplanting', 'Vegetative growth', 'Flowering', 'Grain / fruit development', 'Harvest'];
const dailyValues = (record) => Object.entries(record || {})
  .map(([date, value]) => ({ date, value: Number(value) }))
  .filter(({ date, value }) => /^\d{8}$/.test(date) && Number.isFinite(value) && value >= 0 && value < 9000)
  .sort((a, b) => a.date.localeCompare(b.date));
const formatNumber = (value, digits = 1) => Number.isFinite(Number(value)) ? Number(value).toFixed(digits) : '—';

function makeGuidance({ crop, stage, weather, forecast, rain7d }) {
  const actions = [];
  const nextThreeDaysRain = forecast?.slice(0, 3).reduce((sum, day) => sum + (Number(day.precipitation) || 0), 0) || 0;
  const hot = Number(weather?.temp) >= 35;
  const humid = Number(weather?.humidity) >= 80;

  if (nextThreeDaysRain >= 20) actions.push({ type: 'watch', title: 'Rain likely soon', text: `The forecast totals about ${Math.round(nextThreeDaysRain)} mm over the next three days. Check field drainage and reassess irrigation after the rain.` });
  else if (nextThreeDaysRain < 3 && rain7d != null && rain7d < 8) actions.push({ type: 'action', title: 'Check soil moisture', text: 'Recent rainfall and the near-term forecast are both low. Check the root-zone soil before deciding whether to irrigate.' });
  if (hot) actions.push({ type: 'watch', title: 'Heat stress possible', text: `It is ${Math.round(weather.temp)}°C now. Shift field work to cooler hours and monitor young plants for wilting.` });
  if (humid || nextThreeDaysRain >= 10) actions.push({ type: 'watch', title: 'Monitor for crop disease', text: 'Humid or wet conditions can raise fungal disease pressure. Inspect leaves and follow local crop-protection guidance before spraying.' });

  const stageAdvice = {
    'Land preparation': `For ${crop.toLowerCase()}, prepare a level field and check soil moisture before working the land.`,
    'Sowing / transplanting': `For ${crop.toLowerCase()}, use locally recommended seed and spacing; avoid transplanting or sowing just ahead of heavy rain.`,
    'Vegetative growth': `For ${crop.toLowerCase()}, check soil moisture and weeds regularly; split nutrients according to local soil-test advice.`,
    Flowering: `During ${crop.toLowerCase()} flowering, avoid moisture stress and schedule field operations around rain and strong winds.`,
    'Grain / fruit development': `As ${crop.toLowerCase()} develops, keep monitoring moisture, pests, and lodging risk; adjust irrigation to field conditions.`,
    Harvest: `For ${crop.toLowerCase()} harvest, use a dry weather window where possible and dry produce properly before storage.`,
  }[stage];
  actions.unshift({ type: 'good', title: `${stage} · ${crop}`, text: stageAdvice });
  if (!actions.some((item) => item.type === 'watch' || item.type === 'action')) actions.push({ type: 'good', title: 'Conditions look manageable', text: 'No strong heat or heavy-rain signal is showing in the available readings. Continue checking field and soil conditions.' });
  return actions;
}

export default function AgricultureAdvisory({ location }) {
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
  const [crop, setCrop] = useState('Rice');
  const [stage, setStage] = useState('Vegetative growth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [observations, setObservations] = useState(null);
  const placeName = location?.name || location?.city || 'Your location';

  const load = useCallback(async () => {
    if (!hasCoordinates) { setObservations(null); setLoading(false); return; }
    setLoading(true);
    setError('');
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
      if (!result.nasaAvailable) setError('NASA POWER data is unavailable right now. The advisory uses live weather and forecast only.');
    }
    setLoading(false);
  }, [hasCoordinates, lat, lon]);

  useEffect(() => { load(); }, [load]);

  const guidance = useMemo(() => observations ? makeGuidance({ crop, stage, weather: observations.weather, forecast: observations.forecast, rain7d: observations.rain7d }) : [], [crop, stage, observations]);
  const nextSevenDayRain = observations?.forecast?.reduce((sum, day) => sum + (Number(day.precipitation) || 0), 0);

  return <main className="page-content agri-page">
    <header className="agri-header">
      <div><span className="agri-eyebrow">WEATHER AWARE FARMING</span><h2>Agriculture Advisory</h2><p>Practical crop guidance shaped by current local conditions.</p></div>
      <div className="agri-header-right">{hasCoordinates && <span className="agri-place"><MapPin size={15} />{placeName}</span>}<button className="agri-refresh" onClick={load} disabled={loading || !hasCoordinates} aria-label="Refresh agricultural weather data"><RefreshCw size={16} className={loading ? 'agri-spin' : ''} /> <span>Refresh</span></button></div>
    </header>

    {!hasCoordinates ? <section className="agri-empty"><MapPin size={25} /><h3>Waiting for your location</h3><p>Local weather and crop guidance will appear when your location is available.</p></section>
      : loading && !observations ? <section className="agri-empty"><LoaderCircle size={26} className="agri-spin" /><h3>Loading farm conditions</h3><p>Fetching live weather, forecast, and NASA POWER observations for {placeName}.</p></section>
      : error && !observations ? <section className="agri-empty agri-empty--error"><AlertTriangle size={25} /><h3>Advisory data unavailable</h3><p>{error}</p><button onClick={load}>Try again</button></section>
      : observations && <>
        <section className="agri-condition-banner"><div className="agri-condition-icon">{observations.weather?.icon || '🌦️'}</div><div className="agri-condition-main"><span>Current conditions · {placeName}</span><strong>{observations.weather?.description || 'Weather update'}</strong><small>Updated {new Date(observations.updatedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</small></div><div className="agri-condition-temp">{observations.weather ? `${observations.weather.temp}°` : '—'}<small>C</small></div></section>

        <section className="agri-metrics" aria-label="Local growing conditions">
          <article className="agri-metric"><span className="agri-metric-icon agri-metric-icon--sun"><Sun size={17} /></span><div><small>Solar radiation · NASA POWER</small><strong>{observations.solar == null ? '—' : `${formatNumber(observations.solar)} kWh/m²/day`}</strong><span>7-day daily average</span></div></article>
          <article className="agri-metric"><span className="agri-metric-icon agri-metric-icon--rain"><Droplets size={17} /></span><div><small>Recent rainfall · NASA POWER</small><strong>{observations.rain7d == null ? '—' : `${formatNumber(observations.rain7d)} mm`}</strong><span>Last 7 available days</span></div></article>
          <article className="agri-metric"><span className="agri-metric-icon agri-metric-icon--temp"><Thermometer size={17} /></span><div><small>Temperature &amp; humidity</small><strong>{observations.weather ? `${observations.weather.temp}°C · ${observations.weather.humidity}%` : 'Unavailable'}</strong><span>Current local weather</span></div></article>
          <article className="agri-metric"><span className="agri-metric-icon agri-metric-icon--forecast"><CloudRain size={17} /></span><div><small>Forecast rainfall</small><strong>{Number.isFinite(nextSevenDayRain) ? `${formatNumber(nextSevenDayRain)} mm` : 'Unavailable'}</strong><span>Next 7 forecast days</span></div></article>
        </section>

        <section className="agri-advisory-layout">
          <div className="agri-advisory-card"><div className="agri-card-heading"><span className="agri-card-heading-icon"><Sprout size={18} /></span><div><h3>Your crop advisory</h3><p>Personalize the guidance for your field</p></div></div>
            <div className="agri-select-grid"><label>Crop<select value={crop} onChange={(event) => setCrop(event.target.value)}>{CROPS.map((item) => <option key={item}>{item}</option>)}</select></label><label>Growth stage<select value={stage} onChange={(event) => setStage(event.target.value)}>{STAGES.map((item) => <option key={item}>{item}</option>)}</select></label></div>
            <div className="agri-guidance-list">{guidance.map((item, index) => <article className={`agri-guidance agri-guidance--${item.type}`} key={`${item.title}-${index}`}><span>{item.type === 'watch' || item.type === 'action' ? <AlertTriangle size={16} /> : <Sprout size={16} />}</span><div><strong>{item.title}</strong><p>{item.text}</p></div></article>)}</div>
            <p className="agri-safety-note">Guidance is weather-informed and general. Check field conditions and follow local agricultural extension advice for crop-specific decisions.</p>
          </div>
          <aside className="agri-forecast-card"><div className="agri-card-heading"><span className="agri-card-heading-icon agri-card-heading-icon--blue"><Wind size={18} /></span><div><h3>Next 7 days</h3><p>Forecast for {placeName}</p></div></div>
            {observations.forecast?.length ? <div className="agri-forecast-list">{observations.forecast.slice(0, 7).map((day) => <div className="agri-forecast-row" key={day.date}><span>{day.dayName}</span><span className="agri-forecast-weather">{day.icon} {day.description}</span><strong>{day.maxTemp}° / {day.minTemp}°</strong><small><Droplets size={12} /> {formatNumber(day.precipitation)} mm</small></div>)}</div> : <p className="agri-no-forecast">Forecast is unavailable at the moment.</p>}
          </aside>
        </section>

        <footer className="agri-data-note">Weather &amp; forecast: Open-Meteo · Solar radiation and recent rainfall: NASA POWER (daily point data){!observations.nasaAvailable && <span> · NASA POWER is temporarily unavailable</span>}</footer>
        {error && <div className="agri-inline-note"><AlertTriangle size={14} />{error}</div>}
      </>}
  </main>;
}
