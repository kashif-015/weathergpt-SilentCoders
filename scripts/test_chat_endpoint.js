import app from '../server/app.js';
import http from 'http';

async function main() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  try {
    // 1. Send first message: "Was it raining in Bhilai on 10 September 2026?" (or 2024)
    console.log('\n--- Turn 1: Historical question ---');
    const res1 = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: 'Was it raining in Bhilai on 10 September 2026?',
        location: { name: 'Bhilai', lat: 21.21, lon: 81.38 },
      }),
    });
    const data1 = await res1.json();
    console.log('Turn 1 Status:', res1.status);
    console.log('Turn 1 Output:', data1.message?.content);
    console.log('Turn 1 Context:', JSON.stringify(data1.context));
    const convId = data1.conversationId;
    console.log('Created conversationId:', convId);

    // 2. Follow-up: "What about the next day?"
    console.log('\n--- Turn 2: Follow-up: "What about the next day?" ---');
    const res2 = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: convId,
        message: 'What about the next day?',
      }),
    });
    const data2 = await res2.json();
    console.log('Turn 2 Status:', res2.status);
    console.log('Turn 2 Output:', data2.message?.content);
    console.log('Turn 2 Context:', JSON.stringify(data2.context));

    // 3. Follow-up: "And in Durg?"
    console.log('\n--- Turn 3: Location change: "And in Durg?" ---');
    const res3 = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversationId: convId,
        message: 'And in Durg?',
      }),
    });
    const data3 = await res3.json();
    console.log('Turn 3 Status:', res3.status);
    console.log('Turn 3 Output:', data3.message?.content);
    console.log('Turn 3 Context:', JSON.stringify(data3.context));

  } finally {
    server.close();
  }
}

main().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
