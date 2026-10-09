# WeatherGPT Phase 2 — Implementation Notes

## What was added

Phase 2 adds an instrument-style dashboard alongside the existing chat experience. The **▦** button in the chat header opens it, and **Open chat** returns to the existing conversation without losing the selected location.

The dashboard includes:

- A responsive (two-column mobile / four-column desktop) metric grid for temperature, feels-like temperature, humidity, wind, rainfall, visibility, pressure, and daylight.
- A compass arrow that rotates to the live wind-bearing, a pressure trend calculated against the reading three hours prior, and a sunrise-to-sunset progress arc.
- A calm green "checked" state when there are no active alerts, or colour-coded, horizontally scrollable alert chips when there are hazards. Selecting a chip opens an action-oriented detail card.
- A horizontally scrollable 24-hour forecast with weather, temperature, rain probability, and wind.
- A seven-day forecast whose temperature range bars are scaled against the whole week's high/low range.
- Automatic refresh every 10 minutes and a manual refresh button.

## API endpoints

The Express service in `server/app.js` now exposes the following cache-aware endpoints:

| Endpoint | Cache | Purpose |
| --- | ---: | --- |
| `GET /api/dashboard/current?lat=&lon=` | 10 minutes | Field-level current conditions and sunlight data |
| `GET /api/forecast?lat=&lon=` | 1 hour | 24 hourly observations and seven daily observations |
| `GET /api/alerts/active?lat=&lon=` | 10 minutes | Active extreme-weather signals for the dashboard |

The Vercel rewrite continues to route these through the same Express app. The frontend client is in `src/services/dashboardService.js`; it has a matching memory cache so switching between dashboard and chat does not unnecessarily repeat requests.

## Sources and fallback behavior

### Current conditions

The dashboard response stores a `source` beside each individual metric. This is deliberately field-level rather than whole-response fallback:

| Field | Preferred source | Current fallback / availability |
| --- | --- | --- |
| Temperature, humidity, wind, rainfall, pressure, condition | IMD station/current observations | Open-Meteo point forecast/current data |
| Feels-like temperature | Open-Meteo | Derived formula can be added if the provider does not supply it |
| Visibility | Open-Meteo hourly visibility | No IMD equivalent used |
| Sunrise and sunset | IMD sun/moon endpoint when available | Open-Meteo daily astronomy data |

Open-Meteo is currently the live provider for dashboard point metrics because the existing application has no reliable city-to-IMD-station/district mapping. The endpoint contract is already structured for an IMD value to replace any individual Open-Meteo field as soon as that mapping is supplied; source pills show `OM` now and will show `IMD` when a field originates there.

Weather conditions use one WMO code-to-label/icon normalisation table in the backend so dashboard language stays consistent with chat.

### Forecast

Hourly weather, rain probability and wind are from Open-Meteo because IMD has no dependable public point-level hourly feed. Daily data uses Open-Meteo as the active fallback. The response explicitly labels it as such until an IMD city identifier is resolved; adding that mapping can then make IMD `cityforecast` the daily primary source without a component change.

### Alerts

Official IMD warning feeds require a district identifier. Until a district lookup is implemented, the alert endpoint derives transparent warning signals from Open-Meteo:

- precipitation at least 50 mm: heavy-rain warning;
- wind at least 55 km/h: strong-wind warning;
- daily high at least 40 °C: heat-stress warning;
- current WMO thunderstorm codes: thunderstorm warning.

Each derived alert says so in its detail card. Severity follows the Phase 1 scale: green (clear), yellow (watch), orange (alert), red (danger). This avoids falsely presenting a non-existent official IMD district warning.

## Main files

- `server/app.js` — dashboard, forecast and alert APIs; caching; weather normalisation.
- `src/components/WeatherDashboard.jsx` — dashboard UI and reusable metric/forecast/alert components.
- `src/services/dashboardService.js` — cached frontend API reader.
- `src/App.jsx` — dashboard navigation alongside the chat experience.
- `src/index.css` — Phase 2 visual system and responsive layout.

## Known integration follow-ups

1. Add a validated city-to-IMD station/district mapper. This enables official IMD per-field readings, daily forecasts, district warnings, rainfall, and marine advisories.
2. Use the existing/desired PostGIS coastal-district query once available. Until then, marine alerts intentionally do not appear; presenting them to inland users would be misleading.
3. Connect the existing proactive polling/notification service to the same alert record if it is deployed. The dashboard already has one cached read endpoint ready for that shared state.
