// netlify/functions/log-request-clean.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch'); // needed for sending the POST

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
  ip = '',
  pushoverToken = '',
  pushoverUserKey = ''
} = body;

console.log("🎯 artistId:", artistId);

if (!artistId) {
  console.error("❌ Missing artistId");
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Missing artistId' })
  };
}

// 🗺️ Map artistId to their Sheet IDs
const SHEET_MAP = {
  deanouno: '1Gd6ONQsxR6m6T9oVCoBhztlkhORCsDrOl8Vf5ZCMqKs', // <-- update with actual ID
  deanmar: '17sa45keVke_tftdRiCqDHBj_FTcf-d7klRWiYRRauhE',
  // Add more as needed
};

const sheetId = SHEET_MAP[artistId];
console.log("📄 Sheet ID for artist:", sheetId);

if (!sheetId) {
  console.error("❌ Unknown artistId or missing sheet mapping");
  return {
    statusCode: 400,
    body: JSON.stringify({ error: 'Unknown artistId' })
  };
}

  // Load service account credentials
  const keyPath = path.resolve(__dirname, 'secrets', 'service_account.json');
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
