const { google } = require('googleapis');
const { getClient } = require('./auth');
const { isSpammy } = require('./spamGuard');
const https = require('https');

function sanitize(str, maxLength = 100) {
  return String(str || '').trim().substring(0, maxLength);
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let raw;
  try {
    raw = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const data = {
    artistId: sanitize(raw.artistId, 50),
    name: sanitize(raw.name, 50),
    song: sanitize(raw.song, 150),
    note: sanitize(raw.note, 300),
    ip: sanitize(raw.ip, 45),
    pushoverToken: sanitize(raw.pushoverToken, 50),
    pushoverUserKey: sanitize(raw.pushoverUserKey, 50),
    telegramChatId: sanitize(raw.telegramChatId, 50)
  };

  if (!data.artistId || !data.song) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: artistId and song are required.' })
    };
  }

  // 🛡 Spam guard
  if (isSpammy(data.ip, { artistId: data.artistId, song: data.song, note: data.note })) {
    return {
      statusCode: 429,
      body: JSON.stringify({ error: 'Too many requests. Please wait a bit before trying again.' })
    };
  }

  try {
    const client = await getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const sheetId = process.env.REQUEST_LOG_SHEET_ID;
    const sheetName = data.artistId || 'log';
    const timestamp = new Date().toISOString();

    const row = [timestamp, data.ip, data.name, data.song, data.note];

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [row] }
    });

    // 📣 Pushover Notification
    if (data.pushoverToken && data.pushoverUserKey) {
      const msg = `${data.name || 'Someone'} requested 🎶 ${data.song}`;
      const note = data.note ? `\nNote: ${data.note}` : '';
      const pushoverBody = `token=${data.pushoverToken}&user=${data.pushoverUserKey}&message=${encodeURIComponent(msg + note)}`;

      await fetchPushover(pushoverBody);
    }

    // 📣 Telegram Notification
    if (data.telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
      const text = `🎶 *${data.song}* requested by *${data.name || 'Someone'}*` +
                   (data.note ? `\n💬 ${data.note}` : '');
      await sendTelegramMessage(process.env.TELEGRAM_BOT_TOKEN, data.telegramChatId, text);
    }

    return { statusCode: 200, body: JSON.stringify({ success: true }) };

  } catch (err) {
    console.error('Logging or notification failed:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Internal error' }) };
  }
};

// 🔔 Pushover Helper
function fetchPushover(body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.pushover.net',
      path: '/1/messages.json',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// 🔔 Telegram Helper
function sendTelegramMessage(botToken, chatId, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      chat_id: chatId,
      text: text,
      parse_mode: 'Markdown'
    });

    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${botToken}/sendMessage`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      res.on('data', () => {});
      res.on('end', resolve);
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}
