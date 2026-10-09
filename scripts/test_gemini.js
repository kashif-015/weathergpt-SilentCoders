import 'dotenv/config';

async function main() {
  const key = process.env.GEMINI_API_KEY;
  const tools = [{
    functionDeclarations: [
      {
        name: 'get_current_weather',
        description: 'Get current weather conditions for a location',
        parameters: {
          type: 'OBJECT',
          properties: {
            location: { type: 'STRING', description: 'City or district name' }
          },
          required: ['location']
        }
      }
    ]
  }];

  const r1 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'What is the weather in Bhilai today?' }] }],
      tools
    })
  });
  const d1 = await r1.json();
  console.log('Turn 1 candidate:', JSON.stringify(d1.candidates?.[0]?.content));

  if (!d1.candidates?.[0]?.content) {
    console.log('Error d1:', d1);
    return;
  }

  const modelTurn = d1.candidates[0].content;
  const functionCallPart = modelTurn.parts.find(p => p.functionCall);
  const callName = functionCallPart.functionCall.name;
  const callId = functionCallPart.functionCall.id;

  const toolResponsePart = {
    functionResponse: {
      name: callName,
      response: {
        location: 'Bhilai',
        temperature: 28.5,
        condition: 'Partly cloudy',
        humidity: 62,
        wind_speed: 10
      }
    }
  };
  if (callId) {
    toolResponsePart.functionResponse.id = callId;
  }

  const r2 = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        { role: 'user', parts: [{ text: 'What is the weather in Bhilai today?' }] },
        modelTurn,
        { role: 'user', parts: [toolResponsePart] }
      ],
      tools
    })
  });
  const d2 = await r2.json();
  console.log('Turn 2 response:', JSON.stringify(d2.candidates?.[0]?.content));
  if (d2.error) console.log('Turn 2 error:', d2.error);
}

main().catch(console.error);
