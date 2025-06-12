const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const TIP_LOG_TAB_NAME = 'Tip Log';

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const raw = JSON.parse(event.body);
    const sanitize = (str, maxLen = 100) =>
      String(str || '')
        .replace(/[<>]/g, '')
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .trim()
        .substring(0, maxLen);

    const artistId = sanitize(raw.artistId, 50);
    const method = sanitize(raw.method, 50);

    const creds = require('./secrets/service_account.json');
    console.log('✅ Loaded service account from local file');
    console.log('🔐 client_email:', creds.client_email);

    const auth = new GoogleAuth({
      credentials: creds,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${TIP_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString(), artistId, method]],
      },
    });

    console.log('✅ Tip logged:', artistId, method);

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
