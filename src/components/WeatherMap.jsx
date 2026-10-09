import { useCallback, useEffect, useMemo, useState } from 'react';
import { CircleMarker, GeoJSON, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { ChevronDown, Layers, LoaderCircle, MapPin, X } from 'lucide-react';
import { getBhuvanBoundaries, imdAPI } from '../services/apiClients.js';
import 'leaflet/dist/leaflet.css';

const OWM_KEY = import.meta.env.VITE_OPENWEATHERMAP_API_KEY || '';
const CARTO_KEY = import.meta.env.VITE_CARTO_BASEMAP_KEY || '';
const OWM_LAYERS = [
  ['precipitation', 'Precipitation', 'precipitation_new'],
  ['clouds', 'Clouds', 'clouds_new'],
  ['wind', 'Wind', 'wind_new'],
  ['temperature', 'Temperature', 'temp_new'],
  ['pressure', 'Pressure', 'pressure_new'],
];
const WEATHER_COLORS = { green: '#22c55e', yellow: '#eab308', orange: '#f97316', red: '#ef4444' };

const unpack = (result) => result?.data?.data ?? result?.data ?? result;
const asFeatureCollection = (value) => {
  if (!value) return null;
  if (value.type === 'FeatureCollection' && Array.isArray(value.features)) return value;
  if (value.type === 'Feature') return { type: 'FeatureCollection', features: [value] };
  if (value.type && Array.isArray(value.coordinates)) return { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: value, properties: {} }] };
  if (value.geojson) return asFeatureCollection(value.geojson);
  if (value.features && Array.isArray(value.features)) return { type: 'FeatureCollection', features: value.features };
  return null;
};
const findFeatureCollection = (value, depth = 0) => {
  if (depth > 5 || !value) return null;
  const direct = asFeatureCollection(value);
  if (direct) return direct;
  if (Array.isArray(value)) {
    for (const item of value.slice(0, 30)) {
      const found = findFeatureCollection(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    for (const item of Object.values(value)) {
      const found = findFeatureCollection(item, depth + 1);
      if (found) return found;
    }
  }
  return null;
};
const collectRows = (value, rows = [], depth = 0) => {
  if (depth > 5 || value == null || rows.length > 5000) return rows;
  if (Array.isArray(value)) {
    value.forEach((item) => collectRows(item, rows, depth + 1));
    return rows;
  }
  if (typeof value !== 'object') return rows;
  const keys = Object.keys(value).map((key) => key.toLowerCase());
  if (keys.some((key) => /(district|warning|severity|lat|lon|station|aws)/.test(key))) rows.push(value);
  for (const [key, item] of Object.entries(value)) {
    if (['properties', 'data', 'records', 'districts', 'warnings', 'stations', 'features', 'results'].includes(key.toLowerCase())) collectRows(item, rows, depth + 1);
  }
  return rows;
};
const normalizedName = (value) => String(value || '').toLowerCase().replace(/district/g, '').replace(/[^a-z0-9]/g, '');
const districtName = (feature) => {
  const p = feature?.properties || {};
  return p.district || p.DISTRICT || p.DISTRICT_NAME || p.district_name || p.dtname || p.DTNAME || p.NAME_2 || p.name || p.NAME || 'District';
};
const rowDistrictName = (row) => {
  const p = row?.properties || row || {};
  return p.district || p.DISTRICT || p.DISTRICT_NAME || p.district_name || p.dtname || p.DTNAME || p.NAME_2 || p.name || p.NAME || '';
};
const severityOf = (value) => {
  const text = String(value ?? '').trim().toLowerCase();
  if (/^(1|#ff0000|#f00)$/.test(text)) return 'red';
  if (/^(2|#ffa500|#f90|#ff8c00)$/.test(text)) return 'orange';
  if (/^(3|#ffff00|#ff0|#eab308)$/.test(text)) return 'yellow';
  if (/^(4|#7cfc00|#008000|#00ff00|#0f0)$/.test(text)) return 'green';
  if (/red|very severe|extreme|warning level 3/.test(text)) return 'red';
  if (/orange|severe|warning level 2/.test(text)) return 'orange';
  if (/yellow|moderate|watch|warning level 1/.test(text)) return 'yellow';
  if (/green|no warning|normal|nil|none/.test(text)) return 'green';
  return null;
};
const rowSeverity = (row) => {
  const properties = row?.properties || row || {};
  // IMD publishes a color per forecast day. Use the highest severity across
  // all five days so a later warning is not hidden by a green day-one value.
  const dailyColors = Object.entries(properties)
    .filter(([key]) => /^day[1-5]_color$/i.test(key))
    .map(([, value]) => severityOf(value))
    .filter(Boolean);
  if (dailyColors.length) {
    const rank = { green: 0, yellow: 1, orange: 2, red: 3 };
    return dailyColors.reduce((highest, severity) => rank[severity] > rank[highest] ? severity : highest, 'green');
  }
  const values = Object.entries(properties).filter(([key]) => /(warning|severity|colour|color|alert|level|impact)/i.test(key)).map(([, value]) => value);
  return values.map(severityOf).find(Boolean) || 'green';
};
const warningSummary = (row, severity) => {
  if (!row) return severity === 'green' ? 'No active district warning reported.' : `${severity[0].toUpperCase()}${severity.slice(1)} level warning reported.`;
  const direct = row.warning || row.warning_text || row.description || row.alert || row.impact;
  if (direct) return direct;
  const codes = { 1: 'No warning', 2: 'Heavy rain', 3: 'Heavy snow', 4: 'Thunderstorm and lightning', 5: 'Hailstorm', 6: 'Dust storm', 7: 'Dust raising winds', 8: 'Strong surface winds', 9: 'Heat wave', 10: 'Hot day', 11: 'Warm night', 12: 'Cold wave', 13: 'Cold day', 14: 'Ground frost', 15: 'Fog', 16: 'Very heavy rain', 17: 'Extremely heavy rain' };
  const days = [1, 2, 3, 4, 5].map((day) => {
    const value = row[`Day_${day}`] ?? row[`Day${day}_Warning`] ?? row[`day${day}_warning`];
    if (value == null || value === '') return null;
    const label = String(value).split(',').map((code) => codes[code.trim()] || code.trim()).join(', ');
    return `Day ${day}: ${label}`;
  }).filter(Boolean);
  return days.length ? days.join(' · ') : (severity === 'green' ? 'No active district warning reported.' : `${severity[0].toUpperCase()}${severity.slice(1)} level warning reported.`);
};
const pointOf = (row) => {
  const p = row?.properties || row || {};
  const lat = Number(Object.entries(p).find(([key]) => /^(lat|latitude|y)$/i.test(key))?.[1]);
  const lon = Number(Object.entries(p).find(([key]) => /^(lon|lng|longitude|x)$/i.test(key))?.[1]);
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
};
const asLine = (value) => {
  const rows = collectRows(value).map(pointOf).filter(Boolean);
  return rows.length > 1 ? rows : null;
};
const geoJsonPointLine = (collection) => {
  const points = (collection?.features || []).filter((feature) => feature?.geometry?.type === 'Point' && Array.isArray(feature.geometry.coordinates))
    .map((feature) => [Number(feature.geometry.coordinates[1]), Number(feature.geometry.coordinates[0])])
    .filter(([lat, lon]) => Number.isFinite(lat) && Number.isFinite(lon));
  return points.length > 1 ? points : null;
};
const readValue = (row, pattern) => {
  const p = row?.properties || row || {};
  const entry = Object.entries(p).find(([key]) => pattern.test(key));
  return entry?.[1];
};

function Recenter({ location }) {
  const map = useMap();
  useEffect(() => {
    const lat = Number(location?.lat);
    const lon = Number(location?.lon);
    if (Number.isFinite(lat) && Number.isFinite(lon)) map.setView([lat, lon], Math.max(map.getZoom(), 7), { animate: true });
  }, [location?.lat, location?.lon, map]);
  return null;
}

export default function WeatherMap({ location, onOpenDistrictWarning }) {
  const [weatherLayers, setWeatherLayers] = useState({ precipitation: true, clouds: false, wind: false, temperature: false, pressure: false });
  const [hazardLayers, setHazardLayers] = useState({ districtWarnings: true, cycloneTrack: true, awsStations: false });
  const [layerMenuOpen, setLayerMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dataErrors, setDataErrors] = useState([]);
  const [districtGeo, setDistrictGeo] = useState(null);
  const [warningRows, setWarningRows] = useState([]);
  const [warningsAvailable, setWarningsAvailable] = useState(false);
  const [cycloneTrack, setCycloneTrack] = useState(null);
  const [cycloneWind, setCycloneWind] = useState(null);
  const [cycloneCone, setCycloneCone] = useState(null);
  const [cycloneLine, setCycloneLine] = useState(null);
  const [cycloneActive, setCycloneActive] = useState(false);
  const [cycloneStatus, setCycloneStatus] = useState('loading');
  const [awsRows, setAwsRows] = useState([]);
  const [selectedDistrict, setSelectedDistrict] = useState(null);
  const [tileError, setTileError] = useState(false);

  const center = useMemo(() => {
    const lat = Number(location?.lat);
    const lon = Number(location?.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) ? [lat, lon] : [22.8, 79.0];
  }, [location?.lat, location?.lon]);

  const loadHazards = useCallback(async () => {
    setLoading(true);
    setCycloneStatus('loading');
    setDataErrors([]);
    const results = await Promise.allSettled([
      getBhuvanBoundaries('district'),
      imdAPI.getDistrictWarning(),
      imdAPI.getCycloneTrack(),
      imdAPI.getCycloneWind(),
      imdAPI.getCycloneCone(),
    ]);
    const errors = [];
    if (results[0].status === 'fulfilled') {
      const geo = findFeatureCollection(unpack(results[0].value));
      setDistrictGeo(geo);
      if (!geo) errors.push('District warning shading needs a district GeoJSON proxy. Configure VITE_BHUVAN_PROXY_URL to show warnings on the map.');
    } else errors.push('District boundaries could not be loaded.');
    if (results[1].status === 'fulfilled' && !results[1].value?.error) {
      setWarningRows(collectRows(unpack(results[1].value)));
      setWarningsAvailable(true);
    } else {
      setWarningRows([]);
      setWarningsAvailable(false);
      errors.push('IMD district warning feed is unavailable.');
    }

    const cycloneResults = results.slice(2).map((result) => result.status === 'fulfilled' ? unpack(result.value) : null);
    const cycloneUnavailable = results.slice(2).every((result, index) => result.status === 'rejected' || Boolean(cycloneResults[index]?.error));
    const trackFeatures = findFeatureCollection(cycloneResults[0]);
    const windFeatures = findFeatureCollection(cycloneResults[1]);
    const coneFeatures = findFeatureCollection(cycloneResults[2]);
    const line = trackFeatures ? (asLine(trackFeatures.features) || geoJsonPointLine(trackFeatures)) : asLine(cycloneResults[0]);
    const active = Boolean((trackFeatures?.features?.length || line?.length > 1 || windFeatures?.features?.length || coneFeatures?.features?.length));
    setCycloneTrack(trackFeatures);
    setCycloneWind(windFeatures);
    setCycloneCone(coneFeatures);
    setCycloneLine(line);
    setCycloneActive(active);
    setCycloneStatus(active ? 'active' : cycloneUnavailable ? 'unavailable' : 'none');
    if (cycloneUnavailable) errors.push('Cyclone feed is temporarily unavailable.');
    if (!active) setHazardLayers((current) => ({ ...current, cycloneTrack: false }));
    setDataErrors(errors);
    setLoading(false);
  }, []);

  useEffect(() => { loadHazards(); }, [loadHazards]);
  useEffect(() => {
    if (!hazardLayers.awsStations || awsRows.length) return;
    imdAPI.getAWSData().then((response) => {
      if (response?.error || response?.status === 'unavailable') {
        setDataErrors((current) => [...current, 'AWS station observations are temporarily unavailable.']);
        return;
      }
      setAwsRows(collectRows(unpack(response)));
    }).catch(() => setDataErrors((current) => [...current, 'AWS station observations are temporarily unavailable.']));
  }, [hazardLayers.awsStations, awsRows.length]);

  const warningByDistrict = useMemo(() => {
    const map = new Map();
    warningRows.forEach((row) => {
      const name = normalizedName(rowDistrictName(row));
      if (name) map.set(name, row);
    });
    return map;
  }, [warningRows]);
  const activeWarnings = useMemo(() => warningRows
    .map((row) => ({ row, name: rowDistrictName(row), severity: rowSeverity(row) }))
    .filter(({ name, severity }) => name && severity !== 'green')
    .sort((a, b) => ({ red: 0, orange: 1, yellow: 2 }[a.severity] - { red: 0, orange: 1, yellow: 2 }[b.severity]))
    .slice(0, 5), [warningRows]);
  const styleDistrict = useCallback((feature) => {
    const row = warningByDistrict.get(normalizedName(districtName(feature)));
    if (!warningsAvailable) return { color: '#64748b', weight: 0.7, opacity: 0.65, fillColor: '#64748b', fillOpacity: 0.08 };
    const severity = row ? rowSeverity(row) : 'green';
    const color = WEATHER_COLORS[severity];
    return { color, weight: 0.8, opacity: 0.85, fillColor: color, fillOpacity: severity === 'green' ? 0.12 : 0.42 };
  }, [warningByDistrict, warningsAvailable]);
  const onDistrictFeature = useCallback((feature, layer) => {
    const name = districtName(feature);
    const row = warningByDistrict.get(normalizedName(name));
    const severity = warningsAvailable ? (row ? rowSeverity(row) : 'green') : 'unknown';
    layer.on('click', (event) => setSelectedDistrict({
      name,
      severity,
      center: event.latlng,
      summary: severity === 'unknown' ? 'District warning data is currently unavailable.' : warningSummary(row, severity),
    }));
  }, [warningByDistrict, warningsAvailable]);
  const activeWeather = OWM_LAYERS.filter(([key]) => weatherLayers[key]);

  const toggleWeather = (key) => setWeatherLayers((current) => ({ ...current, [key]: !current[key] }));
  const toggleHazard = (key) => setHazardLayers((current) => ({ ...current, [key]: !current[key] }));

  const layerSwitch = (label, checked, onChange, disabled = false, hint = '') => <label className={`weather-map-layer${disabled ? ' is-disabled' : ''}`} key={label}>
    <span><span>{label}</span>{hint && <small>{hint}</small>}</span>
    <input type="checkbox" checked={checked} disabled={disabled} onChange={onChange} /><i aria-hidden="true" />
  </label>;

  return (
    <section className="weather-map-screen">
      <div className="weather-map-header">
        <div><span className="eyebrow">WEATHERGPT · INDIA</span><h1>Weather Map</h1><p>{location?.name || location?.city || 'India'} · weather and district hazard layers</p></div>
        <button className="weather-map-refresh" onClick={loadHazards} disabled={loading}>{loading ? <LoaderCircle className="weather-map-spin" size={16} /> : '↻'} Refresh data</button>
      </div>
      <div className="weather-map-frame">
        <MapContainer center={center} zoom={Number.isFinite(Number(location?.lat)) ? 7 : 5} minZoom={4} maxZoom={12} scrollWheelZoom zoomControl className="weather-map-canvas">
          <Recenter location={location} />
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' url={`https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png${CARTO_KEY ? `?key=${encodeURIComponent(CARTO_KEY)}` : ''}`} maxZoom={20} />
          {OWM_KEY && activeWeather.map(([key, label, layer]) => <TileLayer key={key} url={`https://tile.openweathermap.org/map/${layer}/{z}/{x}/{y}.png?appid=${OWM_KEY}`} opacity={key === 'precipitation' ? 0.62 : 0.55} eventHandlers={{ tileerror: () => setTileError(true) }} />)}
          {hazardLayers.districtWarnings && districtGeo && <GeoJSON key={`districts-${[...warningByDistrict.entries()].map(([name, row]) => `${name}-${rowSeverity(row)}`).join('|')}`} data={districtGeo} style={styleDistrict} onEachFeature={onDistrictFeature} />}
          {hazardLayers.cycloneTrack && cycloneActive && cycloneWind && <GeoJSON data={cycloneWind} style={{ color: '#fb923c', weight: 1.5, fillColor: '#f97316', fillOpacity: 0.2 }} />}
          {hazardLayers.cycloneTrack && cycloneActive && cycloneCone && <GeoJSON data={cycloneCone} style={{ color: '#ef4444', weight: 2, fillColor: '#f97316', fillOpacity: 0.25, dashArray: '5 5' }} />}
          {hazardLayers.cycloneTrack && cycloneActive && cycloneTrack && <GeoJSON data={cycloneTrack} style={{ color: '#fb3f45', weight: 3 }} />}
          {hazardLayers.cycloneTrack && cycloneActive && cycloneLine && <Polyline positions={cycloneLine} pathOptions={{ color: '#fb3f45', weight: 3 }} />}
          {hazardLayers.awsStations && awsRows.map((station, index) => {
            const point = pointOf(station);
            if (!point) return null;
            return <CircleMarker key={`${point.join(',')}-${index}`} center={point} radius={4} pathOptions={{ color: '#e2e8f0', weight: 1, fillColor: '#38bdf8', fillOpacity: 0.95 }}>
              <Popup><strong>{readValue(station, /station.?name|name|station.?id|station.?code/i) || 'AWS station'}</strong><br />Temperature: {readValue(station, /temp/i) ?? '—'} °C<br />Rainfall: {readValue(station, /rain|precip/i) ?? '—'} mm<br />Wind: {readValue(station, /wind.?speed|wind/i) ?? '—'} km/h</Popup>
            </CircleMarker>;
          })}
          {selectedDistrict && <Popup position={selectedDistrict.center} eventHandlers={{ remove: () => setSelectedDistrict(null) }}>
            <div className="district-popup"><strong>{selectedDistrict.name}</strong><span className={`district-popup__severity severity-${selectedDistrict.severity}`}>{selectedDistrict.severity.toUpperCase()}</span><p>{selectedDistrict.summary}</p><button onClick={() => onOpenDistrictWarning?.({ name: selectedDistrict.name, severity: selectedDistrict.severity, summary: selectedDistrict.summary })}>View alert details</button></div>
          </Popup>}
        </MapContainer>
        <div className="weather-map-control-wrap">
          <button className="weather-map-layer-button" onClick={() => setLayerMenuOpen((open) => !open)} aria-expanded={layerMenuOpen} aria-label="Toggle map layers"><Layers size={18} /><span>Layers</span><ChevronDown size={14} /></button>
          {layerMenuOpen && <div className="weather-map-layer-panel">
            <div className="weather-map-panel-heading"><strong>Map layers</strong><button onClick={() => setLayerMenuOpen(false)} aria-label="Close layers"><X size={16} /></button></div>
            <h3>Weather layers</h3>
            {!OWM_KEY && <p className="weather-map-key-note">Add <code>VITE_OPENWEATHERMAP_API_KEY</code> to enable these overlays.</p>}
            {OWM_LAYERS.map(([key, label]) => layerSwitch(label, weatherLayers[key], () => toggleWeather(key), !OWM_KEY))}
            <h3>Hazard layers</h3>
            {layerSwitch('District warnings', hazardLayers.districtWarnings, () => toggleHazard('districtWarnings'))}
            {layerSwitch('Cyclone track & cone', hazardLayers.cycloneTrack && cycloneActive, () => toggleHazard('cycloneTrack'), !cycloneActive, cycloneStatus === 'loading' ? 'Checking for active cyclones…' : cycloneStatus === 'unavailable' ? 'Cyclone status unavailable' : 'No active cyclone reported')}
            {layerSwitch('AWS stations', hazardLayers.awsStations, () => toggleHazard('awsStations'))}
          </div>}
        </div>
        <div className="weather-map-legend"><strong>District warning</strong>{Object.entries(WEATHER_COLORS).map(([severity, color]) => <span key={severity}><i style={{ background: color }} />{severity[0].toUpperCase() + severity.slice(1)}</span>)}{!warningsAvailable && <span><i style={{ background: '#64748b' }} />Unavailable</span>}</div>
        {(loading || dataErrors.length > 0 || (tileError && OWM_KEY)) && <div className="weather-map-notice">
          {loading && <span><LoaderCircle size={14} className="weather-map-spin" /> Loading India hazard data…</span>}
          {dataErrors.map((error) => <span key={error}><MapPin size={14} /> {error}</span>)}
          {tileError && OWM_KEY && <span>Weather tiles could not be loaded. Check the API key and provider access.</span>}
        </div>}
        {!loading && warningsAvailable && activeWarnings.length > 0 && <div className="weather-map-warning-list" aria-label="Current district warnings">
          <strong>Active district warnings</strong>
          {activeWarnings.map(({ row, name, severity }) => <button key={name} onClick={() => onOpenDistrictWarning?.({ name, severity, summary: warningSummary(row, severity) })}>
            <i className={`severity-dot severity-${severity}`} /><span>{name}</span><small>{severity}</small>
          </button>)}
          {!districtGeo && <small className="weather-map-warning-hint">Map shading needs a configured district boundary feed.</small>}
        </div>}
      </div>
      <p className="weather-map-attribution">Map © OpenStreetMap contributors · CARTO · Weather tiles © OpenWeatherMap · Disaster data © IMD / Bhuvan</p>
    </section>
  );
}
