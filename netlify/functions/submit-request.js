// ✅ Enhanced submit-request.js with built-in spam protection and logging

const { google } = require('googleapis');
const { getClient } = require('./auth');
const { sendTelegramMessage } = require('./send-telegram-message');
const { sendPushoverNotification } = require('./send-pushover-message');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const NOTIFY_TELEGRAM = true;
const NOTIFY_PUSHOVER = true;

const requestHistory = new Map();
const THIRTY_MIN = 30 * 60 * 1000;
const ONE_HOUR = 60 * 60 * 1000;
const FULL_NIGHT = 6 * 60 * 60 * 1000; // Adjustable
const MAX_REQUESTS_30_MIN = 2;
const MAX_REQUESTS_HOUR = 3;
const MAX_REQUESTS_NIGHT = 5;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ip = event.headers['x-forwarded-for'] || 'unknown';
  const now = Date.now();
  let data;

  try {
    data = JSON.parse(event.body);
  } catch (err) {
    return { statusCode: 400, body: 'Invalid request payload.' };
  }

  // Spam Guard Checks
  const history = requestHistory.get(ip) || [];
  const recentHistory = history.filter(ts => now - ts < FULL_NIGHT);

  const count30min = recentHistory.filter(ts => now - ts < THIRTY_MIN).length;
  const countHour = recentHistory.filter(ts => now - ts < ONE_HOUR).length;

  if (count30min >= MAX_REQUESTS_30_MIN) {
    return { statusCode: 429, body: JSON.stringify({ message: '⏳ Too many requests in 30 minutes.' }) };
  }
  if (countHour >= MAX_REQUESTS_HOUR) {
    return { statusCode: 429, body: JSON.stringify({ message: '⏳ Too many requests in 1 hour.' }) };
  }
  if (recentHistory.length >= MAX_REQUESTS_NIGHT) {
    return { statusCode: 429, body: JSON.stringify({ message: '🛑 Max requests reached for the night.' }) };
  }

  // Log this request
  recentHistory.push(now);
  requestHistory.set(ip, recentHistory);

  try {
    const auth = await getClient();
    const sheets = google.sheets({ version: 'v4', auth });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'requests!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: {
        values: [[
          new Date().toISOString(),
          data.artistId || '',
          data.song || '',
          data.note || '',
          ip
        ]]
      }
    });

    if (NOTIFY_TELEGRAM) {
      await sendTelegramMessage(data.artistId, `🎵 New request: ${data.song || 'Unknown'}\n📝 Note: ${data.note || '—'}`);
    }

    if (NOTIFY_PUSHOVER) {
      await sendPushoverNotification(data.artistId, data.song, data.note);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: '✅ Request submitted successfully.' })
    };
  } catch (error) {
    console.error('Logging or notification failed:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: '❌ Internal error logging the request.' })
    };
  }
};
