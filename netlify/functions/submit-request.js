// submit-request.js (Google Sheets API version with rate limiting and notifications)
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';
const CONFIG_TAB_NAME = 'Config';
const REQUEST_LOG_TAB_NAME = 'Requests';

function parseIP(headers) {
  return headers['x-forwarded-for']?.split(',')[0] || headers['client-ip'] || 'unknown';
}

function countRequestsWithin(rows, ip, windowMs, now) {
  return rows.filter(r => {
    const [ts, loggedIp] = r;
    if (!ts || !loggedIp) return false;
    const t = new Date(ts).getTime();
    return loggedIp === ip && now - t <= windowMs;
  }).length;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { artistId, song, note } = JSON.parse(event.body);
    const ip = parseIP(event.headers);
    const now = Date.now();
console.log("➡️ Form submission:", { artistId, song, note, ip });

   
    const keyPath = path.join(__dirname, 'secrets', 'service-account.json');
    const credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/spreadsheets'] });
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const headerResp = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG_SHEET_ID, range: `${CONFIG_TAB_NAME}!A1:Z1` });
    const headers = headerResp.data.values[0];
    const artistIdCol = headers.indexOf('artistId');
    const requestSheetIdCol = headers.indexOf('songListSheetId');
    const telegramChatIdCol = headers.indexOf('telegramChatId');
    const pushoverUserKeyCol = headers.indexOf('pushoverUserKey');

    const configResp = await sheets.spreadsheets.values.get({ spreadsheetId: CONFIG_SHEET_ID, range: `${CONFIG_TAB_NAME}!A2:Z` });
    const artistRow = configResp.data.values.find(r => r[artistIdCol] === artistId);
    const requestSheetId = artistRow[requestSheetIdCol];
    const telegramChatId = telegramChatIdCol !== -1 ? artistRow[telegramChatIdCol] : null;
    const pushoverUserKey = pushoverUserKeyCol !== -1 ? artistRow[pushoverUserKeyCol] : null;
console.log("🛠 Sheet + Notifier Config:", {
  requestSheetId,
  telegramChatId,
  pushoverUserKey,
});

  
    // Fetch request log for rate limiting
    const logResp = await sheets.spreadsheets.values.get({ spreadsheetId: requestSheetId, range: `${REQUEST_LOG_TAB_NAME}!A2:C` });
    const logRows = logResp.data.values || [];

    const count30min = countRequestsWithin(logRows, ip, 30 * 60 * 1000, now);
    const count1hr   = countRequestsWithin(logRows, ip, 60 * 60 * 1000, now);
    const count4hr   = countRequestsWithin(logRows, ip, 4 * 60 * 60 * 1000, now);
console.log("📊 Rate limits for IP", ip, {
  "Last 30 min": count30min,
  "Last 1 hr": count1hr,
  "Last 4 hr": count4hr,
});

    
    const duplicate = logRows.find(r => r[1] === ip && r[2] === song && (now - new Date(r[0]).getTime()) <= 10000);

    if (duplicate) {
      console.log("⚠️ Duplicate request detected — skipping rate limit.");
    }
      if (count30min >= 2 || count1hr >= 3 || count4hr >= 5) {
       console.log("⛔ Rate limit triggered:", { count30min, count1hr, count4hr });

        return {
          statusCode: 429,
          body: 'Rate limit exceeded. Please wait before making more requests.',
        };
      }
    

    const timestamp = new Date().toISOString();
   console.log("📄 Logging to sheet:", [timestamp, ip, song, note || '']);
 
    await sheets.spreadsheets.values.append({
      spreadsheetId: requestSheetId,
      range: `${REQUEST_LOG_TAB_NAME}!A1`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[timestamp, ip, song, note || '']] },
    });

    // ✅ Pushover notification
    if (pushoverUserKey && process.env.PUSHOVER_API_TOKEN) {
      console.log("📬 Sending Pushover to:", pushoverUserKey);

    const res = await fetch('https://api.pushover.net/1/messages.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        token: process.env.PUSHOVER_API_TOKEN,
        user: pushoverUserKey,
        message: `🎵 New request: ${song}\n📝 ${note || '—'}`,
      }),
    });
    const text = await res.text();
    console.log("📬 Pushover response:", text);

    }

    // ✅ Telegram notification
    if (telegramChatId && process.env.TELEGRAM_BOT_TOKEN) {
     console.log("💬 Sending Telegram to:", telegramChatId);

  const telegramRes = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: telegramChatId,
      text: `🎶 New request: ${song}\n📝 ${note || '—'}`,
    }),
  });
  const telegramText = await telegramRes.text();
  console.log("💬 Telegram response:", telegramText);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Request logged successfully' }),
    };
  } catch (err) {
    console.error('Error logging request:', err);
    return { statusCode: 500, body: 'Internal Server Error' };
  }
};
