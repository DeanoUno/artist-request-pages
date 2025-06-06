const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const sendPushoverTip = require('./send-pushover-tip');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c'; // Artist Config Sheet ID
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

    // Load credentials from file
    const keyPath = path.join(__dirname, 'secrets', 'service-account.json');
    const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));

    const auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // Retrieve header row to find column indices
    const headerResp = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${CONFIG_TAB_NAME}!A1:Z1`,
    });

    const headers = headerResp.data.values[0];
    const artistIdCol = headers.indexOf('artistId');
    const songListSheetIdCol = headers.indexOf('songListSheetId');
    const telegramChatIdCol = headers.indexOf('telegramChatId');
    const pushoverUserKeyCol = headers.indexOf('pushoverUserKey');

    if (artistIdCol === -1 || songListSheetIdCol === -1) {
      return { statusCode: 500, body: 'Required columns not found in header row' };
    }

    // Retrieve data rows
    const configResp = await sheets.spreadsheets.values.get({
      spreadsheetId: CONFIG_SHEET_ID,
      range: `${CONFIG_TAB_NAME}!A2:Z`,
    });

    const rows = configResp.data.values || [];
    const artistRow = rows.find(row => row[artistIdCol] === artistId);

    if (!artistRow) {
      return { statusCode: 404, body: `Artist ${artistId} not found in config` };
    }

    const tipSheetId = artistRow[songListSheetIdCol];
    const telegramChatId = telegramChatIdCol !== -1 ? artistRow[telegramChatIdCol] : null;
    const pushoverUserKey = pushoverUserKeyCol !== -1 ? artistRow[pushoverUserKeyCol] : null;

// Log to Tip Log tab
const logTime = timestamp || new Date().toISOString();
const appendResp = await sheets.spreadsheets.values.append({
  spreadsheetId: tipSheetId,
  range: `${TIP_LOG_TAB_NAME}!A1`,
  valueInputOption: 'USER_ENTERED',
  requestBody: {
    values: [[logTime, method]],
  },
});

// ✅ Send Pushover notification if user key and API token are present
if (pushoverUserKey && process.env.PUSHOVER_API_TOKEN) {
  await sendPushoverTip(pushoverUserKey, `💰 You got a new tip via ${method}!`);
}

// ✅ Send Telegram notification if chat ID and bot token are present
if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
  const telegramMessage = `🎶 Someone clicked the ${method} tip button!`;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: telegramMessage,
    }),
  });
}

// Send Telegram notification if chat ID and bot token are present
if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
  const telegramMessage = `🎶 Someone clicked the ${method} tip button!`;

  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: telegramMessage,
    }),
  });
}


    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Tip logged successfully',
        appendResp: appendResp.data,
      }),
    };
  } catch (error) {
    console.error('Error logging tip:', error);
    return { statusCode: 500, body: `Internal Server Error: ${error.message}` };
  }
};
