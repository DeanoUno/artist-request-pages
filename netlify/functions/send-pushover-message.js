const fetch = require('node-fetch');

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

const USER_KEYS = {
  deano: process.env.PUSHOVER_DEANOUNO_USER_KEY,
  // Add more artist keys here as needed
};

async function sendPushoverNotification(artistId, song, note) {
  const userKey = USER_KEYS[artistId] || USER_KEYS['deano'];
  if (!userKey || !PUSHOVER_API_TOKEN) return;

  const message = `🎵 New request: ${song || 'Unknown'}\n📝 Note: ${note || '—'}`;
  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    body: new URLSearchParams({
      token: PUSHOVER_API_TOKEN,
      user: userKey,
      message
    })
  });

  const result = await response.text();
  console.log('✅ Pushover result:', result);
}

module.exports = { sendPushoverNotification };
