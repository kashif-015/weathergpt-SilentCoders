/**
 * WeatherGPT — Structured Conversation Context & Follow-Up Memory Engine
 * Maintains and updates structured conversation context across multi-turn chats.
 */

// Format date in YYYY-MM-DD
export function formatDateYMD(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Get current date string for a timezone
export function getCurrentDateForTimezone(tz = 'Asia/Kolkata') {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return formatDateYMD(new Date());
  }
}

// Add/subtract days from a YYYY-MM-DD string
export function offsetDate(dateStr, offsetDays) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + offsetDays);
  return dt.toISOString().slice(0, 10);
}

/**
 * Creates default empty structured context
 */
export function createEmptyContext(defaultLocation = null) {
  return {
    location: defaultLocation ? {
      name: defaultLocation.name || defaultLocation.city || 'Bhilai',
      latitude: defaultLocation.lat || defaultLocation.latitude || 21.2121,
      longitude: defaultLocation.lon || defaultLocation.longitude || 81.3733,
      timezone: defaultLocation.timezone || 'Asia/Kolkata',
    } : null,
    topic: 'general_weather',
    intent: 'get_current_weather',
    date_range: null,
    weather_variables: ['temperature', 'condition'],
    units: 'metric',
    last_weather_source: null,
    last_alerts: null,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Parses user input to resolve relative follow-ups against existing context.
 */
export function resolveFollowUpIntent(userMessage, currentContext = {}) {
  const text = (userMessage || '').trim().toLowerCase();
  const tz = currentContext?.location?.timezone || 'Asia/Kolkata';
  const todayYmd = getCurrentDateForTimezone(tz);

  const updates = {};
  let handled = false;

  // 1. Check for location correction or change: "Actually, I meant Raipur", "And in Durg?", "What about Durg?"
  const locChangeMatch = text.match(/(?:actually,?\s*(?:i\s*meant|i\s*mean)|and\s*in|what\s*about|how\s*about|in)\s+([a-zA-Z\s]+?)(?:\?|$|\s+too|\s+today|\s+tomorrow|\s+yesterday)/i);
  if (locChangeMatch) {
    const candidateName = locChangeMatch[1].trim();
    const blacklist = ['tomorrow', 'yesterday', 'today', 'the next day', 'day after', 'next week', 'temperature', 'rain', 'humidity', 'wind'];
    if (candidateName.length > 2 && !blacklist.includes(candidateName.toLowerCase())) {
      updates.location = {
        name: candidateName,
        // lat/lon will be geocoded by tool execution
      };
      handled = true;
    }
  }

  // 2. Check for relative date follow-ups:
  // "What about the next day?", "And the next day?", "The day after"
  if (/\b(?:the\s+)?next\s+day\b|\bday\s+after\b/i.test(text)) {
    const baseDate = currentContext?.date_range?.start || todayYmd;
    const nextDate = offsetDate(baseDate, 1);
    if (nextDate) {
      updates.date_range = { start: nextDate, end: nextDate };
      // If the base date was historical, keep historical intent
      if (nextDate < todayYmd) {
        updates.intent = 'get_historical_weather';
        updates.topic = 'historical_weather';
      } else {
        updates.intent = 'get_weather_forecast';
        updates.topic = 'weather_forecast';
      }
      handled = true;
    }
  } else if (/\b(?:the\s+)?previous\s+day\b|\bday\s+before\b/i.test(text)) {
    const baseDate = currentContext?.date_range?.start || todayYmd;
    const prevDate = offsetDate(baseDate, -1);
    if (prevDate) {
      updates.date_range = { start: prevDate, end: prevDate };
      updates.intent = 'get_historical_weather';
      updates.topic = 'historical_weather';
      handled = true;
    }
  } else if (/\btomorrow\b/i.test(text)) {
    const tomorrowYmd = offsetDate(todayYmd, 1);
    updates.date_range = { start: tomorrowYmd, end: tomorrowYmd };
    updates.intent = 'get_weather_forecast';
    updates.topic = 'weather_forecast';
    handled = true;
  } else if (/\byesterday\b/i.test(text)) {
    const yesterdayYmd = offsetDate(todayYmd, -1);
    updates.date_range = { start: yesterdayYmd, end: yesterdayYmd };
    updates.intent = 'get_historical_weather';
    updates.topic = 'historical_weather';
    handled = true;
  }

  // 3. Check for weather variable addition: "Show temperature too", "add wind", "what about humidity"
  const existingVars = Array.isArray(currentContext?.weather_variables) ? [...currentContext.weather_variables] : ['temperature'];
  if (/\b(?:temperature|temp)\b/i.test(text) && !existingVars.includes('temperature')) {
    existingVars.push('temperature');
    updates.weather_variables = existingVars;
  }
  if (/\b(?:rain|rainfall|precipitation)\b/i.test(text) && !existingVars.includes('precipitation')) {
    existingVars.push('precipitation');
    updates.weather_variables = existingVars;
  }
  if (/\b(?:humidity|humid)\b/i.test(text) && !existingVars.includes('humidity')) {
    existingVars.push('humidity');
    updates.weather_variables = existingVars;
  }
  if (/\b(?:wind|wind\s*speed)\b/i.test(text) && !existingVars.includes('wind')) {
    existingVars.push('wind');
    updates.weather_variables = existingVars;
  }

  // 4. Check for warning explanation follow-up: "What does this warning mean?"
  if (/\b(?:what\s+does\s+(?:this|the)\s+warning\s+mean|explain\s+(?:this|the)\s+warning|warning\s+details)\b/i.test(text)) {
    updates.intent = 'explain_alert';
    updates.topic = 'weather_alerts';
    handled = true;
  }

  return { handled, updates };
}

/**
 * Merges previous context with new resolved turn data and tool results
 */
export function mergeConversationContext(previousContext, turnData = {}) {
  const base = previousContext || createEmptyContext();

  const merged = {
    ...base,
    ...turnData,
    location: turnData.location ? { ...base.location, ...turnData.location } : base.location,
    date_range: turnData.date_range !== undefined ? turnData.date_range : base.date_range,
    weather_variables: turnData.weather_variables || base.weather_variables || ['temperature', 'condition'],
    last_updated_at: new Date().toISOString(),
  };

  return merged;
}
