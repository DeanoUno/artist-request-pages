const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const sendPushoverTip = require('./send-pushover-tip');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c'; // Artist Config Sheet ID
const CONFIG_TAB_NAME = 'Config';
const TIP_LOG_TAB_NAME = 'Tip Log';
const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const raw = JSON.parse(event.body);
    const artistId = raw.artistId || 'unknown';
    const method = raw.method || 'Unknown';

    console.log('✅ Tip log received for:', artistId, 'via', method);

    // Load and parse service account from env
    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT);
    console.log('✅ Loaded service account credentials successfully');

    // Auth and initialize Sheets API
    const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    await auth.fromJSON(credentials);  // ✅ Key fix
    const sheets = google.sheets({ version: 'v4', auth });

    // Log to sheet
    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${TIP_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString(), artistId, method]],
      },
    });

    console.log('✅ Tip log appended successfully');

    // Optional: Pushover or Telegram tip notification
    await sendPushoverTip(artistId, method);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Tip logged successfully' }),
    };
  } catch (error) {
    console.error('❌ Error logging tip:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error logging tip' }),
    };
  }
};
