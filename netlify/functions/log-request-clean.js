const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const fetch = require('node-fetch');
const sendPushoverMessage = require('./send-pushover-message');
const sendTelegramMessage = require('./send-telegram-message');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const REQUEST_LOG_TAB_NAME = 'Request Log';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const raw = JSON.parse(event.body);
    const sanitize = (str, maxLen = 300) =>
      String(str || '')
        .replace(/[<>]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .substring(0, maxLen);

    const artistId = sanitize(raw.artistId, 50);
    const name = sanitize(raw.name, 50);
    const song = sanitize(raw.song, 150);
    const note = sanitize(raw.note, 300);
    const ip = sanitize(raw.ip, 45);
    const pushoverToken = sanitize(raw.pushoverToken, 50);
    const pushoverUserKey = sanitize(raw.pushoverUserKey, 50);

    const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT);
    console.log('✅ Loaded service account credentials successfully');

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.fromJSON(credentials);
    const sheets = google.sheets({ version: 'v4', auth });

    const values = [[new Date().toISOString(), name, song, note, ip]];
    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${REQUEST_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values },
    });

    console.log('✅ Request logged for', artistId);

    await sendPushoverMessage(artistId, name, song, note, pushoverToken, pushoverUserKey);
    await sendTelegramMessage(artistId, name, song, note);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Request logged successfully' }),
    };
  } catch (error) {
    console.error('❌ Error logging request:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Error logging request' }),
    };
  }
};
