const voiceApiBase = (import.meta.env.VITE_VOICE_API_BASE_URL || '/api/voice').replace(/\/$/, '');

async function voiceRequest(path, options) {
  let response;
  try {
    response = await fetch(`${voiceApiBase}${path}`, options);
  } catch {
    throw new Error('Sarvam voice server is unavailable. Restart WeatherGPT with npm run dev.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'Voice service request failed.');
  return body;
}

export async function speakSarvamText(text, languageCode = 'en-IN') {
  const result = await voiceRequest('/synthesize', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language_code: languageCode }),
  });
  if (!result.audio) throw new Error('Sarvam returned no audio.');

  const audio = new Audio(`data:audio/wav;base64,${result.audio}`);
  await audio.play();
  return audio;
}
