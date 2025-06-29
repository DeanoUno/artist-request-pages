const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { getArtistConfig } = require('./helpers/getArtistConfig');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = JSON.parse(event.body || '{}');
  const {
    artistId,
    method = ''
  } = body;

  const ip = event.headers['x-forwarded-for']?.split(',')[0] || 'Unavailable';

  console.log("📥 log-tip triggered for artistId:", artistId);

  if (!artistId) {
    console.error("❌ Missing artistId");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing artistId' })
    };
  }

  let sheetId, pushoverToken, pushoverUserKey, telegramChatId;

  try {
    const artistConfig = await getArtistConfig(artistId);
    console.log("🎛️ Loaded artist config:", artistConfig);

    ({
      sheetId,
      pushoverToken,
      pushoverUserKey,
      telegramChatId
    } = artistConfig);

  } catch (err) {
    console.error("❌ Failed to load artist config:", err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Artist configuration not found.' }),
    };
  }

  // Load service account credentials
  const keyPath = path.resolve(__dirname, '_secrets', 'service_account.json');
  const keyFile = fs.readFileSync(keyPath, 'utf8');
  const key = JSON.parse(keyFile);

  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth: jwtClient });

  // ✅ Simplified timestamp
  const now = new Date();
  const formattedTime = now.toLocaleString('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/New_York' // Or your local time zone
  }).replace(',', '');

  const row = [formattedTime, method, ip];

  try {
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Tip Log!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log("💰 Tip log append success:", result.data);

    // ✅ Pushover notification
    if (pushoverToken && pushoverUserKey && method) {
      try {
        const message = `Someone clicked the ${method} tip button.`;
        const pushResponse = await fetch('https://api.pushover.net/1/messages.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: pushoverToken,
            user: pushoverUserKey,
            message,
            title: '💸 Tip Clicked',
            priority: '0'
          })
        });

        const pushText = await pushResponse.text();
        console.log("📲 Pushover response:", pushText);
      } catch (pushErr) {
        console.error("🚫 Failed to send Pushover notification:", pushErr.message);
      }
    }

    // ✅ Telegram notification
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramBotToken && telegramChatId && method) {
      try {
        const message = `💸 Someone clicked the ${method} tip button.`;
        const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

        const tgResponse = await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message
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
    console.error("❌ Error logging tip:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to log tip' }),
    };
  }
};
