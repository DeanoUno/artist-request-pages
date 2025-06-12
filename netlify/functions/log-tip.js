const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const sendPushoverTip = require('./send-pushover-tip');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const CONFIG_TAB_NAME = 'Config';
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

    // ✅ Fix: Properly bind credentials to auth and get client
    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();  // <-- this is what was missing

    const sheets = google.sheets({ version: 'v4', auth: authClient });  // <-- now sheets will be authenticated

    await sheets.spreadsheets.values.append({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${TIP_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[new Date().toISOString(), artistId, method]],
      },
    });

    console.log('✅ Tip log appended successfully');

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
