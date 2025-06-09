// send-pushover-message.js
const fetch = require('node-fetch');

const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;

const ARTIST_USER_KEYS = {
  'deanuno': process.env.PUSHOVER_DEANOUNO_USER_KEY,
  'deanmar': process.env.PUSHOVER_DEANMAR_USER_KEY,
  // Add more as needed
};

async function sendPushoverNotification(artistId, song, note) {
  const userKey = ARTIST_USER_KEYS[artistId.toLowerCase()];
  if (!userKey || !PUSHOVER_API_TOKEN) {
    console.warn('No valid Pushover credentials for', artistId);
    return;
  }

  const message = `🎵 ${song || 'New request'}\n📝 ${note || '—'}`;

  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    body: new URLSearchParams({
      token: PUSHOVER_API_TOKEN,
      user: userKey,
      message
    })
  });

  const result = await response.text();
  console.log('📬 Pushover result:', result);
}

module.exports = { sendPushoverNotification };
