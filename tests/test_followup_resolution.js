import 'dotenv/config';
import {
  createEmptyContext,
  resolveFollowUpIntent,
  analyzeQueryIntent,
  mergeConversationContext,
  getCurrentDateForTimezone,
  offsetDate,
  offsetYear,
} from '../server/services/contextEngine.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName}: ${details}`);
    failed++;
  }
}

async function runRegressionTests() {
  console.log('========================================================================');
  console.log('WeatherGPT: Automated Regression Test Suite for Follow-Up Date & Intent');
  console.log('========================================================================\n');

  const todayStr = getCurrentDateForTimezone('Asia/Kolkata');
  console.log(`Reference Date (Today): ${todayStr}\n`);

  // Simulated Turn 1 Context:
  // User: "How much rainfall was recorded in Bhilai on 10 September 2026?"
  const turn1Analysis = analyzeQueryIntent(
    'How much rainfall was recorded in Bhilai on 10 September 2026?',
    todayStr,
    { name: 'Bhilai', latitude: 21.2121, longitude: 81.3733 }
  );

  let ctxTurn1 = createEmptyContext({ name: 'Bhilai', latitude: 21.2121, longitude: 81.3733 });
  ctxTurn1 = mergeConversationContext(ctxTurn1, {
    ...turn1Analysis,
    last_successful_tool: 'get_historical_weather',
  });

  // Verify Turn 1 context matches specification (Requirement 2 & 4)
  assert(ctxTurn1.location?.name === 'Bhilai', 'Turn 1: location is Bhilai', JSON.stringify(ctxTurn1.location));
  assert(ctxTurn1.resolved_date === '2026-09-10', 'Turn 1: resolved_date is 2026-09-10', ctxTurn1.resolved_date);
  assert(ctxTurn1.intent === 'get_historical_weather', 'Turn 1: intent is get_historical_weather', ctxTurn1.intent);
  assert(ctxTurn1.weather_variables?.includes('precipitation'), 'Turn 1: weather_variables has precipitation', JSON.stringify(ctxTurn1.weather_variables));
  assert(ctxTurn1.data_mode === 'historical_observation', 'Turn 1: data_mode is historical_observation', ctxTurn1.data_mode);
  assert(ctxTurn1.last_successful_tool === 'get_historical_weather', 'Turn 1: last_successful_tool recorded', ctxTurn1.last_successful_tool);

  // ---------------------------------------------------------------------------
  // Test 1: "What about the next day?" (Requirements 3, 4, 5, 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 1: "What about the next day?" ---');
  const resNextDay = resolveFollowUpIntent('What about the next day?', ctxTurn1, {
    lastUserMessage: 'How much rainfall was recorded in Bhilai on 10 September 2026?',
  });

  assert(resNextDay.handled === true, 'Test 1: handled is true');
  assert(resNextDay.updates.resolved_date === '2026-09-11', 'Test 1: Resolved date is 2026-09-11', resNextDay.updates.resolved_date);
  assert(resNextDay.updates.intent === 'get_historical_weather', 'Test 1: Intent is get_historical_weather (NOT forecast)', resNextDay.updates.intent);
  assert(resNextDay.updates.data_mode === 'historical_observation', 'Test 1: Data mode is historical_observation', resNextDay.updates.data_mode);

  const mergedNextDay = mergeConversationContext(ctxTurn1, resNextDay.updates);
  assert(mergedNextDay.location?.name === 'Bhilai', 'Test 1: Location Bhilai preserved', mergedNextDay.location?.name);
  assert(mergedNextDay.weather_variables?.includes('precipitation'), 'Test 1: precipitation variable preserved', JSON.stringify(mergedNextDay.weather_variables));

  // Determine tool to call based on resolved context
  const selectedTool1 = mergedNextDay.intent;
  const toolArgs1 = {
    location: mergedNextDay.location.name,
    date: mergedNextDay.resolved_date,
  };
  assert(selectedTool1 === 'get_historical_weather', 'Test 1: Selected API tool is get_historical_weather');
  assert(toolArgs1.location === 'Bhilai', 'Test 1: Final API location arg is Bhilai');
  assert(toolArgs1.date === '2026-09-11', 'Test 1: Final API date arg is 2026-09-11');

  // ---------------------------------------------------------------------------
  // Test 2: "What about the previous day?" (Requirement 9 & 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 2: "What about the previous day?" ---');
  const resPrevDay = resolveFollowUpIntent('What about the previous day?', ctxTurn1, {
    lastUserMessage: 'How much rainfall was recorded in Bhilai on 10 September 2026?',
  });

  assert(resPrevDay.handled === true, 'Test 2: handled is true');
  assert(resPrevDay.updates.resolved_date === '2026-09-09', 'Test 2: Resolved date is 2026-09-09', resPrevDay.updates.resolved_date);
  assert(resPrevDay.updates.intent === 'get_historical_weather', 'Test 2: Selected API tool is get_historical_weather');
  assert(resPrevDay.updates.data_mode === 'historical_observation', 'Test 2: Data mode is historical_observation');

  const mergedPrevDay = mergeConversationContext(ctxTurn1, resPrevDay.updates);
  const selectedTool2 = mergedPrevDay.intent;
  const toolArgs2 = {
    location: mergedPrevDay.location.name,
    date: mergedPrevDay.resolved_date,
  };
  assert(selectedTool2 === 'get_historical_weather', 'Test 2: Selected API tool is get_historical_weather');
  assert(toolArgs2.date === '2026-09-09', 'Test 2: Final API date arg is 2026-09-09');

  // ---------------------------------------------------------------------------
  // Test 3: "And two days later?" (Requirement 9 & 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 3: "And two days later?" ---');
  const resTwoDaysLater = resolveFollowUpIntent('And two days later?', ctxTurn1, {
    lastUserMessage: 'How much rainfall was recorded in Bhilai on 10 September 2026?',
  });

  assert(resTwoDaysLater.handled === true, 'Test 3: handled is true');
  assert(resTwoDaysLater.updates.resolved_date === '2026-09-12', 'Test 3: Resolved date is 2026-09-12', resTwoDaysLater.updates.resolved_date);
  assert(resTwoDaysLater.updates.intent === 'get_historical_weather', 'Test 3: Selected API tool is get_historical_weather');
  assert(resTwoDaysLater.updates.data_mode === 'historical_observation', 'Test 3: Data mode is historical_observation');

  const mergedTwoDaysLater = mergeConversationContext(ctxTurn1, resTwoDaysLater.updates);
  const toolArgs3 = {
    location: mergedTwoDaysLater.location.name,
    date: mergedTwoDaysLater.resolved_date,
  };
  assert(toolArgs3.date === '2026-09-12', 'Test 3: Final API date arg is 2026-09-12');

  // ---------------------------------------------------------------------------
  // Test 4: "What about the same date last year?" (Requirement 9 & 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 4: "What about the same date last year?" ---');
  const resLastYear = resolveFollowUpIntent('What about the same date last year?', ctxTurn1, {
    lastUserMessage: 'How much rainfall was recorded in Bhilai on 10 September 2026?',
  });

  assert(resLastYear.handled === true, 'Test 4: handled is true');
  assert(resLastYear.updates.resolved_date === '2025-09-10', 'Test 4: Resolved date is 2025-09-10', resLastYear.updates.resolved_date);
  assert(resLastYear.updates.intent === 'get_historical_weather', 'Test 4: Selected API tool is get_historical_weather');
  assert(resLastYear.updates.data_mode === 'historical_observation', 'Test 4: Data mode is historical_observation');

  const mergedLastYear = mergeConversationContext(ctxTurn1, resLastYear.updates);
  const toolArgs4 = {
    location: mergedLastYear.location.name,
    date: mergedLastYear.resolved_date,
  };
  assert(toolArgs4.date === '2025-09-10', 'Test 4: Final API date arg is 2025-09-10');

  // ---------------------------------------------------------------------------
  // Test 5: Historical question followed by a forecast question (Requirement 9 & 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 5: Historical question followed by forecast question ---');
  const resHistToForecast = resolveFollowUpIntent('What is the weather forecast for tomorrow?', ctxTurn1, {
    lastUserMessage: 'How much rainfall was recorded in Bhilai on 10 September 2026?',
  });

  assert(resHistToForecast.handled === true, 'Test 5: handled is true');
  assert(resHistToForecast.updates.intent === 'get_weather_forecast', 'Test 5: Intent switched to get_weather_forecast', resHistToForecast.updates.intent);
  assert(resHistToForecast.updates.data_mode === 'forecast', 'Test 5: Data mode switched to forecast', resHistToForecast.updates.data_mode);

  const expectedTomorrow = offsetDate(todayStr, 1);
  assert(resHistToForecast.updates.resolved_date === expectedTomorrow, `Test 5: Resolved date is tomorrow (${expectedTomorrow})`, resHistToForecast.updates.resolved_date);

  const mergedHistToForecast = mergeConversationContext(ctxTurn1, resHistToForecast.updates);
  assert(mergedHistToForecast.location?.name === 'Bhilai', 'Test 5: Location Bhilai preserved', mergedHistToForecast.location?.name);
  assert(mergedHistToForecast.intent === 'get_weather_forecast', 'Test 5: Selected API tool is get_weather_forecast');

  // ---------------------------------------------------------------------------
  // Test 6: Forecast question followed by a historical question (Requirement 9 & 10)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 6: Forecast question followed by historical question ---');
  // Turn 1 Forecast
  let ctxForecast = createEmptyContext({ name: 'Bhilai', latitude: 21.2121, longitude: 81.3733 });
  ctxForecast = mergeConversationContext(ctxForecast, {
    intent: 'get_weather_forecast',
    data_mode: 'forecast',
    resolved_date: expectedTomorrow,
    date_range: { start: expectedTomorrow, end: expectedTomorrow },
    last_successful_tool: 'get_weather_forecast',
  });

  const resForecastToHist = resolveFollowUpIntent('How much rainfall was recorded there on 10 September 2026?', ctxForecast, {
    lastUserMessage: 'Will it rain in Bhilai tomorrow?',
  });

  assert(resForecastToHist.handled === true, 'Test 6: handled is true');
  assert(resForecastToHist.updates.intent === 'get_historical_weather', 'Test 6: Intent switched to get_historical_weather', resForecastToHist.updates.intent);
  assert(resForecastToHist.updates.data_mode === 'historical_observation', 'Test 6: Data mode switched to historical_observation', resForecastToHist.updates.data_mode);
  assert(resForecastToHist.updates.resolved_date === '2026-09-10', 'Test 6: Resolved date is 2026-09-10', resForecastToHist.updates.resolved_date);

  const mergedForecastToHist = mergeConversationContext(ctxForecast, resForecastToHist.updates);
  assert(mergedForecastToHist.location?.name === 'Bhilai', 'Test 6: Location Bhilai preserved from "there"', mergedForecastToHist.location?.name);
  const toolArgs6 = {
    location: mergedForecastToHist.location.name,
    date: mergedForecastToHist.resolved_date,
  };
  assert(toolArgs6.location === 'Bhilai', 'Test 6: Final API location arg is Bhilai');
  assert(toolArgs6.date === '2026-09-10', 'Test 6: Final API date arg is 2026-09-10');

  // ---------------------------------------------------------------------------
  // Test 7: Clarification when relative date has no base date (Requirement 8)
  // ---------------------------------------------------------------------------
  console.log('\n--- Test 7: Clarification when no base date exists ---');
  const emptyContext = createEmptyContext();
  const resClarify = resolveFollowUpIntent('What about the next day?', emptyContext, {
    lastUserMessage: null,
    messageHistory: [],
  });

  assert(resClarify.needs_clarification === true, 'Test 7: Clarification requested when date cannot be resolved');
  assert(Boolean(resClarify.clarification_question), 'Test 7: Clarification question provided');
  assert(!resClarify.updates.resolved_date, 'Test 7: No silent switch to today or forecast');

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log('\n========================================================================');
  console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runRegressionTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
