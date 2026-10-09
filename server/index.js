import app from './app.js';
const port = Number(process.env.VOICE_SERVER_PORT || 8787);

app.listen(port, () => console.log(`WeatherGPT voice server listening on http://localhost:${port}`));
