const { GoogleSpreadsheet } = require('google-spreadsheet');
const creds = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_CONTENT || '{}');

// Config sheet where all artist info is stored
const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const CONFIG_TAB_NAME = 'config';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: 'Method Not Allowed'
    };
  }

  try {
    const data = JSON.parse(event.body);
    const requiredFields = ['artistId', 'artistName'];
    const missing = requiredFields.filter(f => !data[f]);

    if (missing.length) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields', missing })
      };
    }

    const doc = new GoogleSpreadsheet(CONFIG_SHEET_ID);
    await doc.useServiceAccountAuth({
      client_email: creds.client_email,
      private_key: creds.private_key
    });

    await doc.loadInfo();
    const sheet = doc.sheetsByTitle[CONFIG_TAB_NAME];
    if (!sheet) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Config tab '${CONFIG_TAB_NAME}' not found.` })
      };
    }

    // Add new artist row
    await sheet.addRow({
      artistId: data.artistId,
      artistName: data.artistName,
      venmo: data.venmo || '',
      paypal: data.paypal || '',
      welcomeMsg: data.welcomeMsg || '',
      telegramChatId: '' // Leave blank for now — user must tap Start on Telegram bot
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Artist registered successfully.' })
    };

  } catch (err) {
    console.error('Registration error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', detail: err.message })
    };
  }
};
