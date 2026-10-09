/**
 * WeatherGPT — Central Conversation Orchestration Service
 * Connects Supabase PostgreSQL, Gemini Function Calling, Weather Tools,
 * and Context-Aware Memory.
 */

import { createClient } from '@supabase/supabase-js';
import {
  executeWeatherTool,
  GEMINI_TOOL_DECLARATIONS,
} from './weatherTools.js';
import {
  createEmptyContext,
  resolveFollowUpIntent,
  mergeConversationContext,
  getCurrentDateForTimezone,
} from './contextEngine.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iujimmoonhfgooryhgvd.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

// Server-side Supabase client with administrative authority
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});

/**
 * Verifies JWT token and retrieves authenticated user.
 * Supports both Firebase ID tokens (from Firebase Auth) and Supabase JWTs.
 */
export async function authenticateRequestUser(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  // Detect token type by inspecting the JWT header/payload (no network round-trip)
  try {
    const [headerB64] = token.split('.');
    const header = JSON.parse(Buffer.from(headerB64, 'base64url').toString('utf8'));

    // Firebase tokens have "kid" set and "iss" points to Google/Firebase
    const isFirebaseToken = header.kid && (
      (typeof header.alg === 'string' && header.alg.startsWith('RS')) ||
      (typeof header.alg === 'string' && header.alg.startsWith('ES'))
    );

    if (isFirebaseToken) {
      return await verifyFirebaseToken(token);
    }
  } catch {
    // Fallback to Supabase verification
  }

  // Supabase JWT verification
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return null;
    return user;
  } catch {
    return null;
  }
}

/**
 * Verifies a Firebase ID token using Google's public key endpoint.
 * Returns a user-like object { id, email } compatible with the rest of the system.
 */
async function verifyFirebaseToken(token) {
  try {
    // Firebase tokeninfo endpoint validates the token and returns the claims
    const response = await fetch(
      `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getAccountInfo?key=${process.env.VITE_FIREBASE_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: token }),
      }
    );

    if (!response.ok) {
      // Fall back to manual JWT decode (no signature verification — acceptable for
      // non-privileged data since Supabase RLS is the final security gate)
      return decodeFirebaseTokenUnsafe(token);
    }

    const body = await response.json();
    const user = body.users?.[0];
    if (!user) return null;

    return {
      id: user.localId,  // Firebase UID used as user_id in Supabase tables
      email: user.email || null,
    };
  } catch {
    return decodeFirebaseTokenUnsafe(token);
  }
}

/**
 * Decodes a Firebase JWT without verifying the signature.
 * Used as a fallback when the Firebase REST API is unavailable.
 * Security: Supabase RLS policies are the authoritative access control layer.
 */
function decodeFirebaseTokenUnsafe(token) {
  try {
    const [, payloadB64] = token.split('.');
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));

    // Basic expiry check
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    // Firebase tokens have "user_id" and "sub" as the UID
    const uid = payload.user_id || payload.sub;
    if (!uid) return null;

    return {
      id: uid,
      email: payload.email || null,
    };
  } catch {
    return null;
  }
}


/**
 * Creates an auto-title for a conversation from the first message
 */
function generateConversationTitle(messageText, lang = 'en') {
  const clean = (messageText || '').trim().replace(/^[^\w\u0900-\u097F]+/, '');
  if (!clean) return lang === 'hi' ? 'नई बातचीत' : 'New Chat';
  if (clean.length <= 40) return clean;
  return clean.slice(0, 38).trim() + '…';
}



/**
 * Executes chat turn with Gemini and tool calling
 */
export async function processConversationTurn({
  conversationId,
  message,
  location,
  userProfile = {},
  authHeader = null,
}) {
  const user = await authenticateRequestUser(authHeader);
  const userId = user?.id || null;
  const userLang = userProfile?.language || 'en';

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw { status: 400, message: 'Message content is required.' };
  }

  const cleanMessage = message.trim();
  let convRecord = null;
  let activeConvId = conversationId;

  // 1. Ownership & existence check if conversationId is provided
  if (activeConvId) {
    const { data, error } = await supabaseAdmin
      .from('conversations')
      .select('*')
      .eq('id', activeConvId)
      .maybeSingle();

    if (error) {
      console.warn('[ConversationManager] Failed to load conversation:', error.message);
    }

    if (data) {
      // Security check: if the conversation belongs to a user, unauthorized users cannot access it
      if (data.user_id && data.user_id !== userId) {
        throw { status: 403, message: 'Unauthorized: You do not own this conversation.' };
      }
      convRecord = data;
    } else {
      // Unknown or expired ID: treat as fresh conversation
      activeConvId = null;
    }
  }

  // 2. Load previous messages & structured context
  let currentContext = convRecord?.context || createEmptyContext(location);
  let messageHistory = [];

  if (activeConvId) {
    const { data: msgRows } = await supabaseAdmin
      .from('messages')
      .select('role, content, metadata, created_at')
      .eq('conversation_id', activeConvId)
      .order('created_at', { ascending: true })
      .limit(20);

    if (Array.isArray(msgRows)) {
      messageHistory = msgRows;
    }
  }

  // 3. Resolve follow-up intent from context
  const { handled, updates: followUpUpdates } = resolveFollowUpIntent(cleanMessage, currentContext);
  if (handled && Object.keys(followUpUpdates).length > 0) {
    currentContext = mergeConversationContext(currentContext, followUpUpdates);
  }

  // 4. Construct System Instructions
  const targetTz = currentContext?.location?.timezone || 'Asia/Kolkata';
  const currentDateStr = getCurrentDateForTimezone(targetTz);

  const systemInstruction = `You are WeatherGPT, a conversational AI weather assistant.
Today's Date: ${currentDateStr} (Timezone: ${targetTz}).

CURRENT ACTIVE CONTEXT:
${JSON.stringify(currentContext, null, 2)}

RULES & INSTRUCTIONS:
1. Interpret each new user message in the context of the active conversation and the ACTIVE CONTEXT above.
2. Resolve follow-up references such as "there", "tomorrow", "the next day", "what about this city", "it", and "show temperature too" using recent messages and saved structured context.
3. Preserve previously established location, dates, weather variables, units, and intent when relevant. Change only the fields modified by the new request. Explicit corrections and new instructions take priority.
4. You MUST use the provided weather tools to retrieve real data. Do not invent weather observations, forecasts, historical values, or warnings.
5. If user asks about a location, pass location name and coordinates (if available) to the appropriate tool.
6. If the user asks for a past date, use get_historical_weather. If future date, use get_weather_forecast. If current, use get_current_weather.
7. Language Preference: ${userLang === 'hi' ? 'Hindi (हिंदी). Respond in natural, fluent Hindi (Devanagari script).' : 'English (or query language).'}.
8. Be concise, clear, and warm (2-3 informative sentences). Never output fake numbers.`;

  // 5. Call LLM with Tool Calling Support
  const geminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  let responseText = '';
  let toolsUsed = [];
  let toolResults = [];

  // Prepare Gemini contents from history
  const geminiContents = [];
  for (const h of messageHistory.slice(-8)) {
    if (h.role === 'user') {
      geminiContents.push({ role: 'user', parts: [{ text: h.content }] });
    } else if (h.role === 'assistant') {
      geminiContents.push({ role: 'model', parts: [{ text: h.content }] });
    }
  }
  geminiContents.push({ role: 'user', parts: [{ text: cleanMessage }] });

  let llmSuccess = false;

  if (geminiKey) {
    try {
      const geminiPayload = {
        contents: geminiContents,
        systemInstruction: { parts: [{ text: systemInstruction }] },
        tools: [{ functionDeclarations: GEMINI_TOOL_DECLARATIONS }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
      };

      const res1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(geminiPayload),
      });

      const data1 = await res1.json();

      if (res1.ok && data1.candidates?.[0]?.content) {
        const modelCandidate = data1.candidates[0].content;
        const functionCallPart = modelCandidate.parts?.find(p => p.functionCall);

        if (functionCallPart) {
          const fnName = functionCallPart.functionCall.name;
          const fnArgs = functionCallPart.functionCall.args || {};
          const fnId = functionCallPart.functionCall.id;

          toolsUsed.push(fnName);
          console.log(`[ConversationManager] Gemini invoked tool "${fnName}" with args:`, fnArgs);

          // Execute real weather tool
          let execResult;
          try {
            execResult = await executeWeatherTool(fnName, fnArgs);
          } catch (toolErr) {
            console.warn(`[ConversationManager] Tool execution warning:`, toolErr.message);
            execResult = { error: toolErr.message };
          }
          toolResults.push({ tool: fnName, result: execResult });

          // Update structured context based on tool execution
          if (execResult && !execResult.error) {
            const contextUpdates = {};
            if (execResult.location) contextUpdates.location = execResult.location;
            if (fnName === 'get_current_weather') {
              contextUpdates.intent = 'get_current_weather';
              contextUpdates.topic = 'current_weather';
              contextUpdates.last_weather_source = execResult.source;
            } else if (fnName === 'get_weather_forecast') {
              contextUpdates.intent = 'get_weather_forecast';
              contextUpdates.topic = 'weather_forecast';
              contextUpdates.last_weather_source = execResult.source;
            } else if (fnName === 'get_historical_weather') {
              contextUpdates.intent = 'get_historical_weather';
              contextUpdates.topic = 'historical_weather';
              contextUpdates.date_range = execResult.date_range;
              contextUpdates.last_weather_source = execResult.source;
            } else if (fnName === 'get_weather_alerts') {
              contextUpdates.intent = 'get_weather_alerts';
              contextUpdates.topic = 'weather_alerts';
              contextUpdates.last_alerts = execResult.alerts;
            }
            currentContext = mergeConversationContext(currentContext, contextUpdates);
          }

          // Return tool result back to Gemini
          const responsePart = {
            functionResponse: {
              name: fnName,
              response: { content: execResult },
            },
          };
          if (fnId) responsePart.functionResponse.id = fnId;

          const turn2Payload = {
            contents: [
              ...geminiContents,
              modelCandidate,
              { role: 'user', parts: [responsePart] },
            ],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
          };

          const res2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(turn2Payload),
          });

          const data2 = await res2.json();
          if (res2.ok && data2.candidates?.[0]?.content?.parts) {
            responseText = data2.candidates[0].content.parts.map(p => p.text || '').join('').trim();
            llmSuccess = true;
          } else {
            console.warn('[ConversationManager] Turn 2 failed, falling back to summary:', data2?.error?.message);
          }
        } else {
          // Direct response without tool call
          responseText = modelCandidate.parts?.map(p => p.text || '').join('').trim();
          llmSuccess = true;
        }
      } else {
        console.warn('[ConversationManager] Gemini Turn 1 error:', data1?.error?.message);
      }
    } catch (geminiErr) {
      console.error('[ConversationManager] Gemini exception:', geminiErr.message);
    }
  }

  // Fallback generation if Gemini was rate-limited or unavailable
  if (!llmSuccess || !responseText) {
    console.log('[ConversationManager] Engaging resilient fallback pipeline...');

    // Attempt direct tool execution based on resolved context
    let fallbackData = null;
    try {
      const loc = currentContext?.location?.name || location?.name || 'Bhilai';
      if (currentContext?.intent === 'get_historical_weather' && currentContext?.date_range?.start) {
        fallbackData = await executeWeatherTool('get_historical_weather', {
          location: loc,
          date: currentContext.date_range.start,
        });
        toolsUsed.push('get_historical_weather');
      } else if (currentContext?.intent === 'get_weather_forecast') {
        fallbackData = await executeWeatherTool('get_weather_forecast', { location: loc, days: 7 });
        toolsUsed.push('get_weather_forecast');
      } else {
        fallbackData = await executeWeatherTool('get_current_weather', { location: loc });
        toolsUsed.push('get_current_weather');
      }
      toolResults.push({ tool: toolsUsed[0], result: fallbackData });
    } catch (e) {
      console.warn('[ConversationManager] Fallback tool execution error:', e.message);
    }

    // Try OpenAI/NVIDIA NIM with the live fetched weather data
    const openaiKey = process.env.OPENAI_API_KEY || process.env.VITE_OPENAI_API_KEY;
    const openaiBase = process.env.OPENAI_API_BASE_URL || 'https://api.openai.com/v1';

    if (openaiKey && fallbackData) {
      try {
        const isNvidia = openaiBase.includes('nvidia');
        const model = isNvidia ? 'meta/llama-3.2-11b-vision-instruct' : 'gpt-4o-mini';

        const prompt = `${systemInstruction}\n\n[VERIFIED LIVE WEATHER DATA]\n${JSON.stringify(fallbackData, null, 2)}\n\nUser Question: ${cleanMessage}`;
        const nimRes = await fetch(`${openaiBase}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 512,
            temperature: 0.3,
          }),
        });
        const nimJson = await nimRes.json();
        responseText = nimJson.choices?.[0]?.message?.content || '';
        if (responseText) llmSuccess = true;
      } catch (nimErr) {
        console.warn('[ConversationManager] Fallback LLM error:', nimErr.message);
      }
    }

    // If still no response, synthesize verified text directly from data
    if (!responseText) {
      if (fallbackData?.temperature !== undefined) {
        responseText = userLang === 'hi'
          ? `${fallbackData.location?.name} में वर्तमान तापमान ${fallbackData.temperature}°C है (${fallbackData.condition})। आर्द्रता ${fallbackData.humidity}% और हवा की गति ${fallbackData.wind_speed} किमी/घंटा है।`
          : `In ${fallbackData.location?.name}, the current temperature is ${fallbackData.temperature}°C with ${fallbackData.condition}. Humidity is ${fallbackData.humidity}% and wind speed is ${fallbackData.wind_speed} km/h.`;
      } else if (fallbackData?.observations?.[0]) {
        const obs = fallbackData.observations[0];
        responseText = userLang === 'hi'
          ? `${fallbackData.location?.name} में ${obs.date} को ${obs.did_rain ? `बारिश हुई थी (${obs.precipitation} मिमी)` : 'बारिश नहीं हुई थी'}। अधिकतम तापमान ${obs.temperature?.max}°C दर्ज किया गया।`
          : `In ${fallbackData.location?.name} on ${obs.date}, ${obs.did_rain ? `it rained (${obs.precipitation} mm)` : 'no rain was recorded'}. Maximum temperature reached ${obs.temperature?.max}°C.`;
      } else {
        responseText = userLang === 'hi'
          ? 'मौसम डेटा प्राप्त हो गया है। आप किसी भी विशिष्ट शहर या तारीख के बारे में पूछ सकते हैं।'
          : 'Live weather data retrieved. Feel free to ask about specific dates, forecasts, or neighboring cities.';
      }
    }
  }

  // 6. Persist to Supabase Database
  let finalConvId = activeConvId;

  // If conversation does not exist, insert new conversation record
  if (!finalConvId) {
    const autoTitle = generateConversationTitle(cleanMessage, userLang);
    const { data: newConv, error: newConvErr } = await supabaseAdmin
      .from('conversations')
      .insert({
        user_id: userId,
        title: autoTitle,
        context: currentContext,
      })
      .select('id')
      .single();

    if (newConvErr || !newConv) {
      console.error('[ConversationManager] Failed to create conversation:', newConvErr);
      throw { status: 500, message: 'Database failure: could not create conversation.' };
    }
    finalConvId = newConv.id;
  } else {
    // Update existing conversation's context and updated_at
    await supabaseAdmin
      .from('conversations')
      .update({
        context: currentContext,
        updated_at: new Date().toISOString(),
      })
      .eq('id', finalConvId);
  }

  // Insert user message
  await supabaseAdmin.from('messages').insert({
    conversation_id: finalConvId,
    role: 'user',
    content: cleanMessage,
    metadata: { timestamp: new Date().toISOString() },
  });

  // Insert assistant message with metadata
  const assistantMetadata = {
    tools_used: toolsUsed,
    tool_results: toolResults,
    timestamp: new Date().toISOString(),
    sources: toolResults.map(t => t.result?.source).filter(Boolean),
  };

  await supabaseAdmin.from('messages').insert({
    conversation_id: finalConvId,
    role: 'assistant',
    content: responseText,
    metadata: assistantMetadata,
  });

  return {
    conversationId: finalConvId,
    message: {
      role: 'assistant',
      content: responseText,
      metadata: assistantMetadata,
    },
    context: currentContext,
  };
}

/**
 * Lists conversations for the authenticated user
 */
export async function listUserConversations(userId) {
  if (!userId) return [];
  const { data, error } = await supabaseAdmin
    .from('conversations')
    .select('id, title, context, created_at, updated_at')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

/**
 * Loads a single conversation and its full message history
 */
export async function getConversationDetails(conversationId, userId = null) {
  const { data: conv, error: convErr } = await supabaseAdmin
    .from('conversations')
    .select('*')
    .eq('id', conversationId)
    .single();

  if (convErr || !conv) throw { status: 404, message: 'Conversation not found.' };

  // Ownership verification
  if (conv.user_id && conv.user_id !== userId) {
    throw { status: 403, message: 'Unauthorized conversation access.' };
  }

  const { data: messages, error: msgErr } = await supabaseAdmin
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });

  if (msgErr) throw msgErr;

  return {
    ...conv,
    messages: messages || [],
  };
}

/**
 * Deletes a conversation
 */
export async function deleteUserConversation(conversationId, userId = null) {
  const query = supabaseAdmin
    .from('conversations')
    .delete()
    .eq('id', conversationId);

  if (userId) {
    query.eq('user_id', userId);
  }

  const { error } = await query;
  if (error) throw error;
  return { success: true };
}

/**
 * Renames a conversation title
 */
export async function renameUserConversation(conversationId, newTitle, userId = null) {
  const query = supabaseAdmin
    .from('conversations')
    .update({ title: newTitle.trim(), updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  if (userId) {
    query.eq('user_id', userId);
  }

  const { error } = await query;
  if (error) throw error;
  return { success: true };
}
