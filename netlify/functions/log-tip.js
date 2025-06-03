const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');

// Config values
const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const CONFIG_TAB_NAME = 'Config'; // Update if yours is named differently
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

    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });

    // Step 1: Get the config sheet
    const configResp = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${CONFIG_TAB_NAME}!A1:Z`,
    });

    const rows = configResp.data.values;
    const headers = rows[0];
    const artistIdIndex = headers.indexOf('artistId');
    const sheetIdIndex = headers.indexOf('songListSheetId');

    const row = rows.find((r) => r[artistIdIndex] === artistId);
    if (!row) {
      return { statusCode: 404, body: `Artist ID ${artistId} not found` };
    }

    const artistSheetId = row[sheetIdIndex];

    if (!artistSheetId) {
      return { statusCode: 404, body: `Sheet ID missing for artist ${artistId}` };
    }

    // Step 2: Append to Tip Log
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
