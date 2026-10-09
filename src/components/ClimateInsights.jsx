import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Droplets, LoaderCircle, MapPin, RefreshCw, Thermometer, TrendingUp } from 'lucide-react';
import { getEra5ClimateTrends } from '../services/apiClients.js';

function TrendChart({ series, metric }) {
  const values = series.map((point) => point[metric]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values.map((value, index) => ({
    x: 46 + (index / Math.max(values.length - 1, 1)) * 710,
    y: 220 - ((value - min) / range) * 172,
    year: series[index].year,
    value,
  }));
  const path = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const fill = `${path} L 756 220 L 46 220 Z`;
  const unit = metric === 'meanTemperature' ? '°C' : ' mm';

  return <div className="climate-chart-wrap">
    <div className="climate-chart-ylabels"><span>{(max).toFixed(metric === 'meanTemperature' ? 1 : 0)}{unit}</span><span>{((max + min) / 2).toFixed(metric === 'meanTemperature' ? 1 : 0)}{unit}</span><span>{min.toFixed(metric === 'meanTemperature' ? 1 : 0)}{unit}</span></div>
    <svg className="climate-chart" viewBox="0 0 800 260" role="img" aria-label={`${metric === 'meanTemperature' ? 'Annual mean temperature' : 'Annual precipitation'} from ${series[0].year} to ${series.at(-1).year}`}>
      <defs><linearGradient id="climateArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity=".28"/><stop offset="100%" stopColor="#38bdf8" stopOpacity="0"/></linearGradient></defs>
      {[48, 134, 220].map((y) => <line key={y} x1="46" x2="756" y1={y} y2={y} className="climate-chart-grid" />)}
      <path d={fill} fill="url(#climateArea)" />
      <path d={path} fill="none" className="climate-chart-line" />
      {points.filter((_, index) => index % 5 === 0 || index === points.length - 1).map((point) => <circle key={point.year} cx={point.x} cy={point.y} r="3" className="climate-chart-point"><title>{point.year}: {point.value.toFixed(1)}{unit}</title></circle>)}
    </svg>
  </div>;
}

export default function ClimateInsights({ location }) {
  const [data, setData] = useState(null);
  const [metric, setMetric] = useState('meanTemperature');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lat = Number(location?.lat);
  const lon = Number(location?.lon);
  const hasCoordinates = Number.isFinite(lat) && Number.isFinite(lon);
  const placeName = location?.name || location?.city || 'Your location';

  const load = useCallback(async () => {
    if (!hasCoordinates) { setData(null); setError(''); setLoading(false); return; }
    setLoading(true);
    setError('');
    try { setData(await getEra5ClimateTrends(lat, lon)); }
    catch (requestError) { setError(requestError.message || 'Climate data could not be loaded. Please try again.'); }
    finally { setLoading(false); }
  }, [hasCoordinates, lat, lon]);

  useEffect(() => { load(); /* Refresh when the selected location changes. */ }, [load]);

  const rainfallLabel = useMemo(() => {
    if (data?.precipitationChangePercent == null) return '—';
    const amount = Math.abs(data.precipitationChangePercent);
    return `${data.precipitationChangePercent > 0 ? '+' : data.precipitationChangePercent < 0 ? '−' : ''}${amount}%`;
  }, [data?.precipitationChangePercent]);

  return <main className="page-content climate-page">
    <header className="climate-page-header">
      <div><span className="climate-eyebrow">HISTORICAL REANALYSIS</span><h2>Climate Insights &amp; Trends</h2><p>Long-term temperature and rainfall patterns for your area.</p></div>
      {hasCoordinates && <div className="climate-location"><MapPin size={15} />{placeName}</div>}
    </header>

    {!hasCoordinates ? <section className="climate-state-card"><MapPin size={24} /><h3>Waiting for your location</h3><p>Climate trends will load as soon as WeatherGPT has your current location.</p></section>
      : loading && !data ? <section className="climate-state-card"><LoaderCircle className="weather-map-spin" size={26} /><h3>Loading historical climate data</h3><p>Retrieving the annual ERA5 record for {placeName}.</p></section>
      : error && !data ? <section className="climate-state-card climate-state-card--error"><Activity size={25} /><h3>Climate data is temporarily unavailable</h3><p>{error}</p><button className="climate-retry" onClick={load}><RefreshCw size={15} /> Try again</button></section>
      : data && <>
        <section className="climate-stat-grid" aria-label="Climate trend summaries">
          <article className="climate-stat-card"><span className="climate-stat-icon climate-stat-icon--warm"><Thermometer size={18} /></span><div><span className="climate-stat-label">Temperature trend</span><strong>{data.temperatureTrendCPerDecade > 0 ? '+' : ''}{data.temperatureTrendCPerDecade}°C <small>/ decade</small></strong><p>Annual average, linear trend</p></div></article>
          <article className="climate-stat-card"><span className="climate-stat-icon climate-stat-icon--rain"><Droplets size={18} /></span><div><span className="climate-stat-label">Rainfall change</span><strong>{rainfallLabel}</strong><p>Recent 10 years vs. first 10 years</p></div></article>
          <article className="climate-stat-card climate-stat-card--period"><span className="climate-stat-icon"><TrendingUp size={18} /></span><div><span className="climate-stat-label">Data period</span><strong>{data.period.start}–{data.period.end}</strong><p>Complete calendar years · annual values</p></div></article>
        </section>

        <section className="climate-chart-card">
          <div className="climate-chart-heading"><div><h3>Year-by-year climate record</h3><p>ERA5 annual summaries · {data.period.start} to {data.period.end}</p></div>
            <div className="climate-metric-tabs" role="tablist" aria-label="Chart metric">
              <button role="tab" aria-selected={metric === 'meanTemperature'} className={metric === 'meanTemperature' ? 'is-active' : ''} onClick={() => setMetric('meanTemperature')}>Temperature</button>
              <button role="tab" aria-selected={metric === 'precipitation'} className={metric === 'precipitation' ? 'is-active' : ''} onClick={() => setMetric('precipitation')}>Rainfall</button>
            </div>
          </div>
          <TrendChart series={data.series} metric={metric} />
          <div className="climate-chart-xlabels" aria-hidden="true"><span>{data.period.start}</span><span>{Math.round((data.period.start + data.period.end) / 2)}</span><span>{data.period.end}</span></div>
          <div className="climate-chart-caption"><span>{metric === 'meanTemperature' ? 'Mean annual temperature (°C)' : 'Annual total precipitation (mm)'}</span><span>Dots show selected years</span></div>
        </section>

        <section className="climate-comparison-card"><div className="climate-comparison-icon"><Activity size={18} /></div><div><strong>Decade comparison</strong><p>{data.baselinePeriod.start}–{data.baselinePeriod.end} averaged <b>{data.baselinePeriod.meanTemperature}°C</b> and <b>{data.baselinePeriod.precipitation} mm</b> of annual rainfall. {data.recentPeriod.start}–{data.recentPeriod.end} averaged <b>{data.recentPeriod.meanTemperature}°C</b> and <b>{data.recentPeriod.precipitation} mm</b>.</p></div></section>
        <footer className="climate-source"><span>ⓘ</span><p>Source: {data.source}. ERA5 is a gridded reanalysis estimate (~25 km), not a direct reading from a local weather station. Precipitation is a calendar-year total.</p>{loading && <LoaderCircle size={14} className="weather-map-spin" />}</footer>
      </>}
  </main>;
}
