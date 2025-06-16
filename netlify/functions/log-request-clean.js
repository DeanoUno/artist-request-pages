// netlify/functions/log-request-clean.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch'); // needed for sending the POST
const { getArtistConfig } = require('./helpers/getArtistConfig');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

console.log("📥 log-request-clean triggered");

const body = JSON.parse(event.body || '{}');
console.log("🧾 Parsed body:", body);

const {
  artistId,
  name = '',
  song = '',
  note = '',
  ip = ''
} = body;

console.log("🎯 artistId:", artistId);

if (!artistId) {
  console.error("❌ Missing artistId");
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Missing artistId' })
  };
}

  let artistConfig;
  try {
    artistConfig = await getArtistConfig(artistId);
    console.log("🎛️ Loaded artist config:", artistConfig);
  } catch (err) {
    console.error("❌ Failed to load artist config:", err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Artist configuration not found.' }),
    };
  }

  const {
    sheetId,
    pushoverToken,
    pushoverUserKey,
    telegramChatId
  } = artistConfig;

  // Load service account credentials
const keyPath = path.resolve(__dirname, '_secrets/service_account.json');
  const keyFile = fs.readFileSync(keyPath, 'utf8');
  const key = JSON.parse(keyFile);

  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth: jwtClient });

const now = new Date().toISOString();
const row = [now, name, song, note, ip, pushoverToken, pushoverUserKey];

// ⛔ Rate limiting block STARTS here
try {
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Requests!A2:F',
  });

    const recentRows = (response.data.values || []).filter(r => r[4] === ip);
    const nowTime = Date.now();

    const recentTimestamps = recentRows.map(r => new Date(r[0]).getTime()).sort((a, b) => b - a);

    // ✅ Ignore double-clicks within 10 seconds
    if (recentTimestamps.length && nowTime - recentTimestamps[0] < 10 * 1000) {
      console.warn(`⏱️ Ignoring duplicate request from ${ip} within 10 seconds`);
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, ignored: true })
      };
    }

    const countIn = mins => recentTimestamps.filter(t => nowTime - t < mins * 60 * 1000).length;

    if (countIn(4 * 60) >= 5 || countIn(60) >= 3 || countIn(30) >= 2) {
      console.warn(`⛔ Rate limit hit for IP ${ip}`);
      return {
        statusCode: 429,
        body: JSON.stringify({ error: 'Too many requests from this IP.' })
      };
    }
  } catch (rateErr) {
    console.error("⚠️ Rate limiting check failed (non-blocking):", rateErr.message);
  }
  // ⛔ Rate limiting block ENDS here

  // ⬇️ Now safe to log the request
  try {
    console.log("📝 Preparing to append row to sheet:", sheetId);
    console.log("📝 Row data:", row);

    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Requests!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

  console.log("✅ Append response:", result.data);

  // ✅ Optional: Send Pushover notification
  if (pushoverToken && pushoverUserKey && song) {
    try {
      const message = `${name || 'Someone'} requested: ${song}`;
      const pushResponse = await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: pushoverToken,
          user: pushoverUserKey,
          message,
          title: '🎶 New Song Request',
          priority: '0'
        })
      });

      const pushText = await pushResponse.text();
      console.log("📲 Pushover response:", pushText);
    } catch (pushErr) {
      console.error("🚫 Failed to send Pushover notification:", pushErr.message);
    }
  }
// ✅ Optional: Send Telegram notification
const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;

if (telegramBotToken && telegramChatId && song) {
  try {
    const message = `${name || 'Someone'} requested: ${song}`;
    const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

    const tgResponse = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: telegramChatId,
        text: `🎶 ${message}`
      })
    });

    const tgText = await tgResponse.text();
    console.log("📬 Telegram response:", tgText);
  } catch (tgErr) {
    console.error("🚫 Failed to send Telegram notification:", tgErr.message);
  }
}

  return {
    statusCode: 200,
    body: JSON.stringify({ success: true }),
  };

} catch (error) {
  console.error("❌ Error logging request:", error.message);
  return {
    statusCode: 500,
    body: JSON.stringify({ error: 'Failed to log request' }),
  };
}
};
