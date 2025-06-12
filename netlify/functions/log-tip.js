const { google } = require('googleapis');
const { JWT } = require('google-auth-library');
const fs = require('fs');
const path = require('path');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const TIP_LOG_TAB_NAME = 'Tip Log';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const raw = JSON.parse(event.body);
    const artistId = raw.artistId || 'unknown';
    const method = raw.method || 'Unknown';

    console.log('✅ Tip log received for:', artistId, 'via', method);

    const credentials = JSON.parse(fs.readFileSync(path.join(__dirname, 'secrets/service_account.json')));
    console.log('✅ Loaded service account from local file');

    const authClient = new JWT({
      email: credentials.client_email,
      key: credentials.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: authClient });

    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${TIP_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString(), artistId, method]],
      },
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Tip logged successfully' }) };
  } catch (err) {
    console.error('❌ Error logging tip:', err);
    return { statusCode: 500, body: 'Error logging tip' };
  }
};