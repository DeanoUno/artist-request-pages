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

  const {
    artistId,
    name = '',
    song = '',
    note = '',
    ip = '',
    pushoverToken = '',
    pushoverUserKey = ''
  } = body;

  if (!artistId) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing artistId' })
    };
  }

  // Map artist IDs to Sheet IDs (replace with dynamic lookup in production)
  const SHEET_MAP = {
    deanuno: '1Gd6ONQsxR6m6T9oVCoBhztlkhORCsDrOl8Vf5ZCMqKs',
    deanmar: '17sa45keVke_tftdRiCqDHBj_FTcf-d7klRWiYRRauhE',
    // Add more as needed
  };

  const sheetId = SHEET_MAP[artistId];
  if (!sheetId) {
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
    const result = await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Requests!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log("✅ Request logged:", result.data.updates);
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
