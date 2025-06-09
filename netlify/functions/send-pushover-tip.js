const fetch = require('node-fetch');

module.exports = async function sendPushoverTip(userKey, message) {
const token = process.env.PUSHOVER_TIP_API_TOKEN;

  console.log('🔑 Pushover token in tip script:', token);
  console.log('👤 User key in tip script:', userKey);

  if (!token || !userKey) {
    console.warn('⚠️ Missing Pushover token or userKey');
    return;
  }

  const response = await fetch('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    body: new URLSearchParams({
      token,
      user: userKey,
      message,
    }),
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  const result = await response.text();
  console.log('📬 Pushover result:', result);
};
