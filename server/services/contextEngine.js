/**
 * WeatherGPT — Structured Conversation Context & Follow-Up Memory Engine
 * Maintains and updates structured conversation context across multi-turn chats.
 */

// Format date in YYYY-MM-DD
export function formatDateYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
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

// Add/subtract years from a YYYY-MM-DD string (handles leap years)
export function offsetYear(dateStr, offsetYears) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetYear = y + offsetYears;
  const isLeap = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
  let targetDay = d;
  if (m === 2 && d === 29 && !isLeap) {
    targetDay = 28;
  }
  return `${targetYear}-${String(m).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`;
}

const MONTH_NAMES = {
  january: 1, jan: 1,
  february: 2, feb: 2,
  march: 3, mar: 3,
  april: 4, apr: 4,
  may: 5,
  june: 6, jun: 6,
  july: 7, jul: 7,
  august: 8, aug: 8,
  september: 9, sept: 9, sep: 9,
  october: 10, oct: 10,
  november: 11, nov: 11,
  december: 12, dec: 12,
};

const NUMBER_WORDS = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  ek: 1, do: 2, teen: 3, chaar: 4, paanch: 5,
};

function parseNumber(str) {
  if (!str) return null;
  const s = String(str).trim().toLowerCase();
  if (NUMBER_WORDS[s] !== undefined) return NUMBER_WORDS[s];
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

/**
 * Extracts explicit calendar dates from a text string (e.g. "10 September 2026", "2026-09-10")
 */
export function extractExplicitDate(text, referenceYear = null) {
  if (!text || typeof text !== 'string') return null;
  const lower = text.toLowerCase();

  // Pattern 1: ISO "2026-09-10"
  const isoMatch = lower.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // Pattern 2: "10 September 2026" or "10th September, 2026"
  const monthRegex = 'january|february|march|april|may|june|july|august|september|sept|sep|october|oct|november|nov|december|dec';
  const dmyMatch = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthRegex})\\s*,?\\s*(\\d{4})\\b`, 'i'));
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = MONTH_NAMES[dmyMatch[2].toLowerCase()];
    const year = Number(dmyMatch[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern 3: "September 10, 2026" or "September 10th 2026"
  const mdyMatch = lower.match(new RegExp(`\\b(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})\\b`, 'i'));
  if (mdyMatch) {
    const month = MONTH_NAMES[mdyMatch[1].toLowerCase()];
    const day = Number(mdyMatch[2]);
    const year = Number(mdyMatch[3]);
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Pattern 4: Date without year: "10 September", "September 10th"
  const noYearMatch = lower.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${monthRegex})\\b|\\b(${monthRegex})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'i'));
  if (noYearMatch) {
    const day = Number(noYearMatch[1] || noYearMatch[4]);
    const mStr = (noYearMatch[2] || noYearMatch[3]).toLowerCase();
    const month = MONTH_NAMES[mStr];
    const year = referenceYear || new Date().getFullYear();
    if (month && day >= 1 && day <= 31) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

/**
 * Extracts weather variables requested in the user message
 */
export function extractWeatherVariables(text, existingVars = ['temperature', 'condition']) {
  if (!text) return existingVars;
  const lower = text.toLowerCase();
  const vars = new Set();

  if (/\b(?:rain|rainfall|precipitation|drizzle|shower|monsoon|barish|baarish|pani)\b/i.test(lower)) {
    vars.add('precipitation');
  }
  if (/\b(?:temperature|temp|heat|cold|garmi|thand|taapman)\b/i.test(lower)) {
    vars.add('temperature');
  }
  if (/\b(?:wind|windy|breeze|gust|hawa)\b/i.test(lower)) {
    vars.add('wind');
  }
  if (/\b(?:humidity|humid|moisture|nami)\b/i.test(lower)) {
    vars.add('humidity');
  }
  if (/\b(?:pressure|barometer)\b/i.test(lower)) {
    vars.add('pressure');
  }

  if (vars.size === 0) {
    return existingVars;
  }
  return Array.from(vars);
}

/**
 * Extracts location candidates from query
 */
export function extractLocationName(text) {
  if (!text) return null;
  const nonLocationWords = new Set([
    'today', 'tomorrow', 'yesterday', 'the next day', 'day after', 'previous day', 'next day',
    'day before', 'last year', 'this week', 'next week', 'forecast', 'weather', 'rain',
    'rainfall', 'temperature', 'wind', 'humidity', 'what', 'how', 'when', 'there', 'it',
    'the same date', 'same date', 'two days later', 'days later', 'days earlier'
  ]);

  const patterns = [
    /\b(?:in|at|around|near|recorded in)\s+([a-zA-Z\s]{2,30}?)(?:\s+on|\s+on\s+\d|\s+in\s+\d|\?|$|,|\s+yesterday|\s+today|\s+tomorrow)/i,
    /\b(?:actually,?\s*(?:i\s*meant|i\s*mean)|and\s*in)\s+([a-zA-Z\s]{2,30}?)(?:\?|$|\s+too|\s+today|\s+tomorrow|\s+yesterday)/i,
    /\b(?:what\s*about|how\s*about)\s+(?:in\s+)?([a-zA-Z\s]{2,30}?)(?:\?|$|\s+too|\s+today|\s+tomorrow|\s+yesterday)/i,
    /\b([a-zA-Z\s]{2,30}?)\s+(?:mein|me|ka|ki|ke\s*liye)\b/i,
  ];

  for (const p of patterns) {
    const match = text.match(p);
    if (match) {
      const candidate = match[1].trim();
      const candLower = candidate.toLowerCase();
      // Must not contain temporal or meteorological words
      if (
        candLower.length > 2 &&
        !nonLocationWords.has(candLower) &&
        !/\b(?:day|date|year|week|month|tomorrow|yesterday|forecast|weather|rain|temp|humidity|wind|next|prev|following|earlier|later)\b/i.test(candLower)
      ) {
        return candidate;
      }
    }
  }
  return null;
}

/**
 * Creates default empty structured context satisfying all required fields:
 * - location
 * - resolved_date or date_range
 * - intent
 * - weather_variables
 * - data_mode: current, forecast, historical_observation, or climate
 * - last successful weather tool
 */
export function createEmptyContext(defaultLocation = null) {
  return {
    location: defaultLocation ? {
      name: defaultLocation.name || defaultLocation.city || 'Bhilai',
      latitude: defaultLocation.lat || defaultLocation.latitude || 21.2121,
      longitude: defaultLocation.lon || defaultLocation.longitude || 81.3733,
      timezone: defaultLocation.timezone || 'Asia/Kolkata',
    } : null,
    resolved_date: null,
    date_range: null,
    intent: 'get_current_weather',
    weather_variables: ['temperature', 'condition'],
    data_mode: 'current',
    last_successful_tool: null,
    topic: 'general_weather',
    units: 'metric',
    last_weather_source: null,
    last_alerts: null,
    last_updated_at: new Date().toISOString(),
  };
}

/**
 * Analyzes a standalone or new query to initialize structured context.
 */
export function analyzeQueryIntent(text, todayYmd, defaultLocation = null) {
  const lower = (text || '').toLowerCase();
  const extractedDate = extractExplicitDate(text);
  const locationName = extractLocationName(text);
  const vars = extractWeatherVariables(text, ['temperature', 'condition']);

  let intent = 'get_current_weather';
  let data_mode = 'current';
  let resolved_date = null;
  let date_range = null;

  // 1. Explicit historical indicators or past date
  const isHistoricalPhrase = /\b(?:was\s+recorded|did\s+it\s+rain|historical|history|recorded\s+on|in\s+the\s+past|was\s+it|hua\s+tha|pichle|past)\b/i.test(lower);
  if (extractedDate) {
    resolved_date = extractedDate;
    date_range = { start: extractedDate, end: extractedDate };
    if (extractedDate < todayYmd || isHistoricalPhrase) {
      intent = 'get_historical_weather';
      data_mode = 'historical_observation';
    } else if (extractedDate > todayYmd) {
      intent = 'get_weather_forecast';
      data_mode = 'forecast';
    } else {
      intent = 'get_current_weather';
      data_mode = 'current';
    }
  } else if (isHistoricalPhrase) {
    intent = 'get_historical_weather';
    data_mode = 'historical_observation';
  } else if (/\b(?:forecast|upcoming|next\s+\d+\s+days?|will\s+it|tomorrow|aane\s+wale)\b/i.test(lower)) {
    intent = 'get_weather_forecast';
    data_mode = 'forecast';
    const tomorrowYmd = offsetDate(todayYmd, 1);
    resolved_date = tomorrowYmd;
    date_range = { start: tomorrowYmd, end: tomorrowYmd };
  } else if (/\b(?:alert|warning|cyclone|disaster)\b/i.test(lower)) {
    intent = 'get_weather_alerts';
    data_mode = 'current';
  } else if (/\b(?:climate|trend|era5|global\s+warming)\b/i.test(lower)) {
    intent = 'get_era5_climate';
    data_mode = 'climate';
  }

  const updates = {
    intent,
    data_mode,
    weather_variables: vars,
    topic: intent,
  };

  if (resolved_date) {
    updates.resolved_date = resolved_date;
    updates.date_range = date_range;
  }
  if (locationName) {
    updates.location = {
      ...(defaultLocation || {}),
      name: locationName,
    };
  }

  return updates;
}

/**
 * Resolves follow-up queries against existing context and previous user requests.
 * Complies with Requirements 1 to 8:
 * - Resolves relative dates relative to the previously referenced date, NOT the current date.
 * - Maintains location, resolved_date, date_range, intent, weather_variables, data_mode, last_successful_tool.
 * - Asks for clarification if relative date cannot be resolved confidently.
 * - Prefers original user request over assistant output.
 */
export function resolveFollowUpIntent(userMessage, currentContext = {}, historyContext = {}) {
  const text = (userMessage || '').trim();
  const lower = text.toLowerCase();
  const tz = currentContext?.location?.timezone || 'Asia/Kolkata';
  const todayYmd = getCurrentDateForTimezone(tz);

  let handled = false;
  let needs_clarification = false;
  let clarification_question = null;
  const updates = {};

  // 1. Retrieve previous reference date
  // Priority 1: Validated structured context (Requirement 7)
  let baseDate = currentContext?.resolved_date || currentContext?.date_range?.start || null;

  // Priority 2: Original user request from history (Requirement 7)
  if (!baseDate && historyContext?.lastUserMessage) {
    baseDate = extractExplicitDate(historyContext.lastUserMessage);
  }
  if (!baseDate && Array.isArray(historyContext?.messageHistory)) {
    for (let i = historyContext.messageHistory.length - 1; i >= 0; i--) {
      const msg = historyContext.messageHistory[i];
      if (msg.role === 'user') {
        const found = extractExplicitDate(msg.content);
        if (found) {
          baseDate = found;
          break;
        }
      }
    }
  }

  // 2. Check for explicit location change
  const locChangeName = extractLocationName(text);
  if (locChangeName && locChangeName.toLowerCase() !== currentContext?.location?.name?.toLowerCase()) {
    updates.location = {
      ...(currentContext?.location || {}),
      name: locChangeName,
    };
    handled = true;
  }

  // 3. Check for relative date follow-ups
  const isNextDay = /\b(?:the\s+)?next\s+day\b|\b(?:the\s+)?following\s+day\b|\bday\s+after\b|\bagle\s+din\b/i.test(lower);
  const isPrevDay = /\b(?:the\s+)?previous\s+day\b|\b(?:the\s+)?day\s+before\b|\bprior\s+day\b|\bpichle\s+din\b/i.test(lower);
  const daysLaterMatch = lower.match(/(?:and\s+)?(\w+|\d+)\s+days?\s+(?:later|after)\b/i);
  const daysEarlierMatch = lower.match(/(?:and\s+)?(\w+|\d+)\s+days?\s+(?:earlier|before|prior)\b/i);
  const isSameDateLastYear = /\b(?:the\s+)?same\s+(?:date|day)\s+(?:last\s+year|previous\s+year)\b|\blast\s+year\s+on\s+the\s+same\s+(?:date|day)\b/i.test(lower);
  const isTomorrow = /\btomorrow\b|\bkal\b/i.test(lower) && !isHistoricalPhrase(lower);
  const isYesterday = /\byesterday\b/i.test(lower);

  const isRelativeDateQuery = isNextDay || isPrevDay || Boolean(daysLaterMatch) || Boolean(daysEarlierMatch) || isSameDateLastYear;

  // Requirement 8: If relative date query has no reference date, ask for clarification
  if (isRelativeDateQuery && !baseDate) {
    return {
      handled: true,
      needs_clarification: true,
      clarification_question: 'Could you please specify which date and location you would like to check? Please provide the date.',
      updates: {},
    };
  }

  let resolvedDate = null;

  if (isNextDay) {
    resolvedDate = offsetDate(baseDate, 1);
    handled = true;
  } else if (isPrevDay) {
    resolvedDate = offsetDate(baseDate, -1);
    handled = true;
  } else if (daysLaterMatch) {
    const num = parseNumber(daysLaterMatch[1]);
    if (num !== null) {
      resolvedDate = offsetDate(baseDate, num);
      handled = true;
    }
  } else if (daysEarlierMatch) {
    const num = parseNumber(daysEarlierMatch[1]);
    if (num !== null) {
      resolvedDate = offsetDate(baseDate, -num);
      handled = true;
    }
  } else if (isSameDateLastYear) {
    resolvedDate = offsetYear(baseDate, -1);
    handled = true;
  } else if (isTomorrow) {
    resolvedDate = offsetDate(todayYmd, 1);
    handled = true;
  } else if (isYesterday) {
    resolvedDate = offsetDate(todayYmd, -1);
    handled = true;
  } else {
    // Check for an explicit new date in this follow-up query
    const explicitInTurn = extractExplicitDate(text, baseDate ? parseInt(baseDate.slice(0, 4), 10) : null);
    if (explicitInTurn) {
      resolvedDate = explicitInTurn;
      handled = true;
    }
  }

  // 4. Intent and Data Mode resolution (Requirement 3, 4, 5, 6)
  const isExplicitForecast = /\b(?:forecast|will\s+it|upcoming|next\s+\d+\s+days?|aane\s+wale)\b/i.test(lower) || (isTomorrow && !isHistoricalPhrase(lower));
  const isExplicitHistorical = isHistoricalPhrase(lower) || (resolvedDate && resolvedDate < todayYmd && !isExplicitForecast);

  if (isExplicitForecast) {
    // Explicit transition to forecast
    updates.intent = 'get_weather_forecast';
    updates.data_mode = 'forecast';
    updates.topic = 'weather_forecast';
    handled = true;
  } else if (isExplicitHistorical || (isRelativeDateQuery && currentContext?.data_mode === 'historical_observation')) {
    // Maintain historical observation mode and historical intent
    updates.intent = 'get_historical_weather';
    updates.data_mode = 'historical_observation';
    updates.topic = 'historical_weather';
    handled = true;
  } else if (resolvedDate) {
    if (resolvedDate < todayYmd) {
      updates.intent = 'get_historical_weather';
      updates.data_mode = 'historical_observation';
      updates.topic = 'historical_weather';
    } else {
      updates.intent = 'get_weather_forecast';
      updates.data_mode = 'forecast';
      updates.topic = 'weather_forecast';
    }
    handled = true;
  }

  if (resolvedDate) {
    updates.resolved_date = resolvedDate;
    updates.date_range = { start: resolvedDate, end: resolvedDate };
  }

  // 5. Weather variables preservation or extension (Requirement 4 & 6)
  const newVars = extractWeatherVariables(text, null);
  if (newVars && newVars.length > 0) {
    // If user asked to add or switch variables
    if (/\b(?:too|also|as\s+well|and)\b/i.test(lower)) {
      const mergedVars = Array.from(new Set([...(currentContext?.weather_variables || []), ...newVars]));
      updates.weather_variables = mergedVars;
    } else {
      updates.weather_variables = newVars;
    }
    handled = true;
  } else if (currentContext?.weather_variables) {
    // Preserve existing weather variables (e.g. precipitation)
    updates.weather_variables = currentContext.weather_variables;
  }

  return {
    handled,
    needs_clarification,
    clarification_question,
    updates,
  };
}

function isHistoricalPhrase(lower) {
  return /\b(?:was\s+recorded|did\s+it\s+rain|historical|history|recorded\s+on|in\s+the\s+past|was\s+it|hua\s+tha|pichle|past)\b/i.test(lower);
}

/**
 * Merges previous context with new resolved turn data and tool results.
 * Only updates fields that were modified (Requirement 6).
 */
export function mergeConversationContext(previousContext, turnData = {}) {
  const base = previousContext || createEmptyContext();

  const merged = {
    ...base,
    ...turnData,
    location: turnData.location ? { ...base.location, ...turnData.location } : base.location,
    resolved_date: turnData.resolved_date !== undefined ? turnData.resolved_date : base.resolved_date,
    date_range: turnData.date_range !== undefined ? turnData.date_range : base.date_range,
    intent: turnData.intent || base.intent || 'get_current_weather',
    data_mode: turnData.data_mode || base.data_mode || 'current',
    weather_variables: turnData.weather_variables || base.weather_variables || ['temperature', 'condition'],
    last_successful_tool: turnData.last_successful_tool !== undefined ? turnData.last_successful_tool : base.last_successful_tool,
    last_updated_at: new Date().toISOString(),
  };

  return merged;
}
