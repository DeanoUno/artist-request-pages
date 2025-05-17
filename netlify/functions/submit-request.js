const fetch = require('node-fetch');

exports.handler = async function (event, context) {
  try {
    const data = JSON.parse(event.body);
    const { name, song, note, artistId, ip, pushoverUserKey, pushover_token } = data;

    if (!song || !artistId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required fields" }),
      };
    }

    // Format message
    const msg = `🎶 New request for ${artistId}\n\n` +
                `${song}${note ? `\n\n💬 ${note}` : ''}${name ? `\n🙋 ${name}` : ''}${ip ? `\n🌐 IP: ${ip}` : ''}`;

    // Send Pushover notification
    const response = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: pushover_token,
        user: pushoverUserKey,
        message: msg,
        title: `🎤 Song Request: ${song}`,
        priority: 0
      })
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        statusCode: 502,
        body: JSON.stringify({ error: "Pushover error", details: text })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Internal Server Error", details: err.message }),
    };
  }
};
