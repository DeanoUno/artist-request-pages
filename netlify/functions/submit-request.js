// submit-request.js
const fetch = require('node-fetch');

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const data = JSON.parse(event.body);
  const required = ['song', 'artistId', 'pushoverToken', 'pushoverUserKey'];
  const missing = required.filter(key => !data[key]);

  if (missing.length) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields', missing })
    };
  }

  try {
    await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: data.pushoverToken,
        user: data.pushoverUserKey,
        title: '🎵 New Song Request',
        message: `${data.song}${data.name ? ' from ' + data.name : ''}${data.note ? '\nNote: ' + data.note : ''}`,
        priority: 0
      })
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Request submitted and notification sent.' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to send notification', details: err.message })
    };
  }
};
