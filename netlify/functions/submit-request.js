const { google } = require('googleapis');
const { getClient } = require('./auth');
const fetch = require('node-fetch');

const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const PUSHOVER_API_TOKEN = process.env.PUSHOVER_API_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

const RATE_LIMIT_MS = 60 * 1000; // 1 minute per IP
const recentRequests = new Map(); // { ip: { time, song } }

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const data = JSON.parse(event.body);
    const ip = event.headers['x-forwarded-for'] || 'unknown';
    const now = Date.now();

    const previous = recentRequests.get(ip);
    if (
      previous &&
      now - previous.time < RATE_LIMIT_MS &&
      previous.song === data.song
    ) {
      return {
        statusCode: 429,
        body: JSON.stringify({ message: 'Duplicate request too soon.' })
      };
    }

    // Allow and log request
    recentRequests.set(ip, { time: now, song: data.song });

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

    // Pushover notification
    if (data.pushoverUserKey && PUSHOVER_API_TOKEN) {
      await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        body: new URLSearchParams({
          token: PUSHOVER_API_TOKEN,
          user: data.pushoverUserKey,
          message: `🎵 ${data.song}\n📝 ${data.note || ''}`,
          title: `🎤 Song Request from ${data.artistId || 'Fan'}`
        })
      });
    }

    // Telegram notification
    if (data.telegramChatId && TELEGRAM_BOT_TOKEN) {
      const message = `🎵 Song: ${data.song}\n📝 Note: ${data.note || ''}`;
      await fetch(
        `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: data.telegramChatId,
            text: message
          })
        }
      );
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Request logged and notified.' })
    };
  } catch (err) {
    console.error('ERROR', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', detail: err.message })
    };
  }
};
