// netlify/functions/log-request-clean.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

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
  const keyPath = path.resolve(__dirname, 'secrets', 'service-account.json');
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
