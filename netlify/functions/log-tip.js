const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const fs = require('fs');

// Config constants
const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const CONFIG_TAB_NAME = 'Config';
const TIP_LOG_TAB_NAME = 'Tip Log';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { artistId, method, timestamp } = JSON.parse(event.body);

    if (!artistId || !method) {
      return { statusCode: 400, body: 'Missing artistId or method' };
    }

    // Path to your service account key file
    const keyFilePath = path.join(__dirname, 'service-account.json');

    if (!fs.existsSync(keyFilePath)) {
      return {
        statusCode: 500,
        body: 'Service account credentials file not found.',
      };
    }

    const auth = new GoogleAuth({
      keyFile: keyFilePath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

    // Get config sheet rows
    const configResp = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${CONFIG_TAB_NAME}!A1:Z`,
    });

    const rows = configResp.data.values;
    const headers = rows[0];
    const artistIdIndex = headers.indexOf('artistId');
    const sheetIdIndex = headers.indexOf('songListSheetId');

    const artistRow = rows.find((r) => r[artistIdIndex] === artistId);
    if (!artistRow) {
      return { statusCode: 404, body: `Artist ID ${artistId} not found` };
    }

    const artistSheetId = artistRow[sheetIdIndex];
    if (!artistSheetId) {
      return { statusCode: 404, body: `Sheet ID missing for artist ${artistId}` };
    }

    // Append to the "Tip Log" tab
    const now = timestamp || new Date().toISOString();
    const appendResp = await sheets.spreadsheets.values.append({
      spreadsheetId: artistSheetId,
      range: `${TIP_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[now, method]],
      },
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Tip logged successfully', appendResp }),
    };
  } catch (err) {
    console.error('Error logging tip:', err);
    return {
      statusCode: 500,
      body: `Internal Server Error: ${err.message}`,
    };
  }
};
