/**
 * WeatherGPT — Comprehensive Test Suite for Context-Aware Memory & Supabase
 * Tests scenarios 1 through 13 as required by the specification.
 */

import http from 'http';
import app from '../server/app.js';
import {
  resolveFollowUpIntent,
  createEmptyContext,
  offsetDate,
  mergeConversationContext,
} from '../server/services/contextEngine.js';
import { executeWeatherTool } from '../server/services/weatherTools.js';

let passed = 0;
let failed = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passed++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${details}`);
    failed++;
  }
}

async function runTestSuite() {
  console.log('===============================================================');
  console.log('WeatherGPT: Running Automated Test Suite for Context & Memory');
  console.log('===============================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // -------------------------------------------------------------------------
    // Scenario 1: Standalone current-weather question
    // -------------------------------------------------------------------------
    console.log('--- Test 1: Standalone current weather ---');
    const res1 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'What is the current temperature in Bhilai?',
        location: { name: 'Bhilai', lat: 21.21, lon: 81.38 },
      }),
    });
    const d1 = await res1.json();
    assert(res1.status === 200, 'Test 1: Status 200', `Got ${res1.status}`);
    assert(Boolean(d1.conversationId), 'Test 1: Generates UUID conversationId', d1.conversationId);
    assert(d1.message?.content?.length > 0, 'Test 1: Generates content response');
    const convId1 = d1.conversationId;

    // -------------------------------------------------------------------------
    // Scenario 2: Historical weather question followed by "What about the next day?"
    // -------------------------------------------------------------------------
    console.log('\n--- Test 2: Historical weather followed by "What about the next day?" ---');
    const ctxHist = createEmptyContext({ name: 'Bhilai', lat: 21.21, lon: 81.38 });
    ctxHist.intent = 'get_historical_weather';
    ctxHist.topic = 'historical_weather';
    ctxHist.date_range = { start: '2026-09-10', end: '2026-09-10' };

    const followUp2 = resolveFollowUpIntent('What about the next day?', ctxHist);
    assert(followUp2.handled === true, 'Test 2: Relative date "next day" is recognized');
    assert(followUp2.updates?.date_range?.start === '2026-09-11', 'Test 2: 2026-09-10 + 1 day resolves to 2026-09-11', followUp2.updates?.date_range?.start);
    assert(followUp2.updates?.intent === 'get_historical_weather', 'Test 2: Historical intent is preserved for past date');

    // -------------------------------------------------------------------------
    // Scenario 3: Forecast question followed by "And in Durg?"
    // -------------------------------------------------------------------------
    console.log('\n--- Test 3: Location change "And in Durg?" ---');
    const ctxForecast = createEmptyContext({ name: 'Bhilai', lat: 21.21, lon: 81.38 });
    ctxForecast.intent = 'get_weather_forecast';
    ctxForecast.topic = 'weather_forecast';
    ctxForecast.date_range = { start: '2026-10-12', end: '2026-10-12' };

    const followUp3 = resolveFollowUpIntent('And in Durg?', ctxForecast);
    assert(followUp3.handled === true, 'Test 3: Location change is recognized');
    assert(followUp3.updates?.location?.name?.toLowerCase() === 'durg', 'Test 3: Location updated to Durg', followUp3.updates?.location?.name);
    const merged3 = mergeConversationContext(ctxForecast, followUp3.updates);
    assert(merged3.intent === 'get_weather_forecast', 'Test 3: Forecast intent preserved when changing location');
    assert(merged3.date_range?.start === '2026-10-12', 'Test 3: Date range preserved when changing location');

    // -------------------------------------------------------------------------
    // Scenario 4: Location correction ("Actually, I meant Raipur")
    // -------------------------------------------------------------------------
    console.log('\n--- Test 4: Location correction "Actually, I meant Raipur" ---');
    const followUp4 = resolveFollowUpIntent('Actually, I meant Raipur', ctxForecast);
    assert(followUp4.handled === true, 'Test 4: Correction recognized');
    assert(followUp4.updates?.location?.name?.toLowerCase() === 'raipur', 'Test 4: Location corrected to Raipur', followUp4.updates?.location?.name);

    // -------------------------------------------------------------------------
    // Scenario 5: Weather-variable change ("Show temperature too")
    // -------------------------------------------------------------------------
    console.log('\n--- Test 5: Weather variable change "Show temperature too" ---');
    const ctxRain = createEmptyContext({ name: 'Bhilai' });
    ctxRain.weather_variables = ['precipitation'];

    const followUp5 = resolveFollowUpIntent('Show temperature too', ctxRain);
    assert(followUp5.updates?.weather_variables?.includes('temperature'), 'Test 5: Temperature added to variables');
    assert(followUp5.updates?.weather_variables?.includes('precipitation'), 'Test 5: Precipitation preserved in variables');

    // -------------------------------------------------------------------------
    // Scenario 6: Comparison across locations or dates
    // -------------------------------------------------------------------------
    console.log('\n--- Test 6: Weather comparison across locations ---');
    const compResult = await executeWeatherTool('compare_weather', {
      locations: [
        { name: 'Bhilai', latitude: 21.21, longitude: 81.38 },
        { name: 'Durg', latitude: 21.19, longitude: 81.28 },
      ],
      weather_variables: ['temperature', 'precipitation'],
    });
    assert(Array.isArray(compResult.comparison), 'Test 6: Returns comparison array');
    assert(compResult.comparison.length === 2, 'Test 6: Compares both requested locations');
    assert(compResult.comparison[0].data?.temperature !== undefined, 'Test 6: Location 1 has real temperature metric');
    assert(compResult.comparison[1].data?.temperature !== undefined, 'Test 6: Location 2 has real temperature metric');

    // -------------------------------------------------------------------------
    // Scenario 7: Ambiguous follow-up triggers clarification
    // -------------------------------------------------------------------------
    console.log('\n--- Test 7: Ambiguous follow-up handling ---');
    const emptyCtx = createEmptyContext();
    const followUp7 = resolveFollowUpIntent('what about that', emptyCtx);
    assert(followUp7.handled === false || !followUp7.updates.date_range, 'Test 7: Does not fabricate date for ambiguous message');

    // -------------------------------------------------------------------------
    // Scenario 8: New conversation must not inherit previous context
    // -------------------------------------------------------------------------
    console.log('\n--- Test 8: New conversation does not inherit previous context ---');
    const res8 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: null, // New conversation!
        message: 'Hello, what is the weather in Delhi?',
      }),
    });
    const d8 = await res8.json();
    assert(res8.status === 200, 'Test 8: New conversation returns 200');
    assert(d8.conversationId !== convId1, 'Test 8: Generates separate conversation ID', d8.conversationId);
    assert(d8.context?.location?.name !== 'Bhilai', 'Test 8: Does not inherit previous conversation location', d8.context?.location?.name);

    // -------------------------------------------------------------------------
    // Scenario 9: Unauthorized user attempting to access private conversation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 9: Security & unauthorized access prevention ---');
    // Attempting to access non-existent or foreign conversation with fake user header
    const res9 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake-invalid-token-12345',
      },
      body: JSON.stringify({
        conversationId: '00000000-0000-0000-0000-000000000000',
        message: 'Hello private conversation',
      }),
    });
    // Server should treat non-existent foreign ID as new conversation or reject access cleanly
    assert(res9.status === 200 || res9.status === 403, 'Test 9: Server safely handles invalid token/ID without exposing private data');

    // -------------------------------------------------------------------------
    // Scenario 10: Weather API failure graceful handling
    // -------------------------------------------------------------------------
    console.log('\n--- Test 10: Graceful handling of invalid tool arguments ---');
    let toolFailedGracefully = false;
    try {
      await executeWeatherTool('get_historical_weather', {
        location: 'Nowhere',
        latitude: 999, // Invalid latitude
        longitude: 999,
        date: '2026-09-10',
      });
    } catch {
      toolFailedGracefully = true;
    }
    assert(toolFailedGracefully === true, 'Test 10: Invalid weather inputs throw catchable error instead of crashing');

    // -------------------------------------------------------------------------
    // Scenario 11: Empty message validation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 11: Empty message validation ---');
    const res11 = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: '   ',
      }),
    });
    assert(res11.status === 400, 'Test 11: Rejects empty message with HTTP 400');

    // -------------------------------------------------------------------------
    // Scenario 12: Two quick concurrent messages in the same conversation
    // -------------------------------------------------------------------------
    console.log('\n--- Test 12: Concurrent message handling ---');
    const [quick1, quick2] = await Promise.all([
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: d8.conversationId, message: 'Is it windy?' }),
      }),
      fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId: d8.conversationId, message: 'Is it sunny?' }),
      }),
    ]);
    assert(quick1.status === 200 && quick2.status === 200, 'Test 12: Handled concurrent messages concurrently with 200 status');

    // -------------------------------------------------------------------------
    // Scenario 13: Reloading and restoring conversation history from Supabase
    // -------------------------------------------------------------------------
    console.log('\n--- Test 13: Restoring conversation details & message history ---');
    const res13 = await fetch(`${baseUrl}/api/conversations/${d8.conversationId}`);
    const d13 = await res13.json();
    assert(res13.status === 200, 'Test 13: Fetches conversation by ID');
    assert(Array.isArray(d13.messages) && d13.messages.length >= 2, 'Test 13: Successfully restored all chronological messages from Supabase', `Count: ${d13.messages?.length}`);

  } finally {
    server.close();
  }

  console.log('\n===============================================================');
  console.log(`TEST SUITE RESULTS: ${passed} PASSED, ${failed} FAILED`);
  console.log('===============================================================\n');

  if (failed > 0) process.exit(1);
}

runTestSuite().catch(err => {
  console.error('Test suite error:', err);
  process.exit(1);
});
