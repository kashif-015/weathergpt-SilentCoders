# 🌦️ WeatherGPT — AI-Powered Weather Intelligence Platform

> **HackBios Hackathon Project** · Team: SilentCoders

WeatherGPT is a full-stack, AI-first weather application that combines real-time meteorological data with a context-aware conversational interface. Ask questions in plain English (or Hindi), follow up naturally across turns, and get precise, data-backed answers — all in one seamless experience.

---

## ✨ Key Features

### 🤖 AI Conversational Weather Assistant
- **Multi-turn context memory** — follow-up questions like *"What about the next day?"* or *"And last year?"* resolve correctly without repeating yourself
- **Gemini function calling** — LLM decides which weather tool to invoke based on intent (current, forecast, historical, agriculture, cyclone…)
- **Persistent chat history** — conversations are stored per-user in Supabase PostgreSQL with Row Level Security

### 🌐 Interactive Weather Map
- Leaflet-based map with OpenWeatherMap overlay layers (precipitation, clouds, wind, temperature, pressure)
- CARTO Dark Matter basemap
- District-level IMD hazard warning overlay with color-coded severity (Green / Yellow / Orange / Red)
- Built-in India District GeoJSON fallback when the ISRO Bhuvan API is unavailable

### 📊 Live Weather Dashboard
- Real-time current conditions: temperature, feels-like, humidity, wind (compass + speed), pressure trend, rainfall, visibility, UV index, daylight progress arc
- 24-hour scrollable hourly forecast with rain probability and wind
- 7-day daily forecast with scaled temperature range bars
- Auto-refresh every 10 minutes; manual refresh button

### 🌾 Agriculture Advisory
- Crop-stage-aware AI advisory tailored to the farmer's registered location, season, and current weather
- Supports multiple crops, languages, and advisory focus areas (irrigation, pest, harvest, soil…)
- Text-to-speech playback, clipboard copy, and WhatsApp share

### 🚨 Hazard Alerts & Seismic Activity
- Live global disaster alerts from GDACS
- Real-time earthquake feed (India region, USGS-compatible) with magnitude and depth
- IMD district warning grid with 5-day severity forecast — deterministic fallback when upstream IMD API is unreachable
- Expandable "View All" lists to browse full alert feeds

### 📡 Forecast Page
- Detailed hourly and daily forecasts with WaveForecastCard component
- Defaults to the hourly view for quick glanceability
- AI-generated weather insights powered by Gemini

### 🔐 Authentication
- **Firebase Authentication** — Google Sign-In + email/password
- **Supabase Auth** — Supabase JWT as an alternative
- Dual-token verification: the server auto-detects Firebase vs. Supabase JWT and validates accordingly
- User profile includes name, occupation, language preference, and age — stored for personalised advisory

---

## 🏗️ Project Structure

```
weathergpt-app/
├── api/                        # Vercel serverless entry points
│   ├── index.js
│   └── [...path].js
├── server/
│   ├── app.js                  # Express API: weather, IMD, dashboard, alerts, chat
│   ├── index.js                # Local server entrypoint
│   └── services/
│       ├── conversationManager.js   # Supabase + Gemini orchestration, dual-auth verification
│       ├── contextEngine.js         # Follow-up date/intent resolution engine
│       └── weatherTools.js          # Open-Meteo, IMD, GDACS, Nominatim tool suite
├── src/
│   ├── App.jsx                 # Root component, routing, sidebar navigation
│   ├── index.css               # Global design system (dark mode, glassmorphism)
│   └── components/
│       ├── WeatherDashboard.jsx
│       ├── WeatherMap.jsx
│       ├── AlertsPage.jsx
│       ├── ForecastPage.jsx
│       ├── WaveForecastCard.jsx
│       ├── AgricultureAdvisory.jsx
│       ├── AuthModal.jsx
│       ├── ProfilePage.jsx / ProfileModal.jsx
│       ├── HomePage.jsx
│       ├── InteractiveEarth.jsx
│       ├── WeatherAnimation.jsx
│       ├── ClimateInsights.jsx
│       ├── RightPanel.jsx
│       ├── TopBar.jsx
│       └── WeatherIcon.jsx
│   └── services/
│       ├── chatEngine.js       # Frontend chat orchestration
│       ├── apiClients.js       # All API fetch wrappers with in-memory caching
│       ├── weatherService.js   # Weather data aggregation
│       ├── firebaseClient.js   # Firebase Auth SDK wrapper
│       ├── supabaseClient.js   # Supabase client + conversation CRUD
│       ├── chatHistory.js      # Local + remote chat history sync
│       ├── voiceService.js     # Web Speech API TTS wrapper
│       ├── dashboardService.js # Cached dashboard API reads
│       └── translations.js     # i18n strings (en/hi)
├── supabase/
│   └── migrations/             # PostgreSQL schema with RLS policies
├── public/
│   └── india_districts.json    # India district GeoJSON (local fallback)
├── scripts/                    # Dev utilities and test scripts
├── tests/
│   └── test_followup_resolution.js  # Regression suite: 47 date/intent tests
├── .env.example                # All required environment variables documented
├── vite.config.js
├── vercel.json
└── package.json
```

## 🌐 API Endpoints

All endpoints are served from `server/app.js` and proxied through Vite in development or Vercel functions in production.

| Method | Endpoint | Cache | Description |
|---|---|:---:|---|
| `GET` | `/api/dashboard/current` | 10 min | Current conditions (temp, humidity, wind, pressure...) |
| `GET` | `/api/forecast` | 1 hr | 24-hour hourly + 7-day daily forecast |
| `GET` | `/api/alerts/active` | 10 min | Active extreme-weather signals |
| `GET` | `/api/imd/:endpoint` | 5-15 min | IMD API proxy (districtwarning, cyclone, nowcast...) |
| `POST` | `/api/chat` | — | Gemini-powered conversational turn |
| `GET` | `/api/conversations` | — | List user's saved conversations |
| `GET` | `/api/conversations/:id` | — | Get conversation with full message history |
| `DELETE` | `/api/conversations/:id` | — | Delete a conversation |
| `PATCH` | `/api/conversations/:id/rename` | — | Rename a conversation |
| `GET` | `/api/weather/current` | 5 min | Point weather current conditions |
| `GET` | `/api/weather/forecast` | 1 hr | Point weather forecast |
| `GET` | `/api/weather/historical` | 24 hr | Historical weather data |
| `GET` | `/api/earthquakes` | 15 min | USGS seismic feed (India region) |
| `GET` | `/api/cyclone` | 15 min | Active cyclone data |
| `GET` | `/api/gdacs/alerts` | 10 min | GDACS global disaster alerts |
---

## 📜 License

Built for **HackBios** by **Team SilentCoders**. All rights reserved.
