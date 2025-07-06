// netlify/functions/log-tip.js

const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const fetch = require('node-fetch');
const { getArtistConfig } = require('./helpers/getArtistConfig');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const body = JSON.parse(event.body || '{}');
  const { artistId, method = '' } = body;
  const ip = event.headers['x-forwarded-for']?.split(',')[0] || 'Unavailable';

  console.log("📥 log-tip triggered for artistId:", artistId);

  if (!artistId) {
    console.error("❌ Missing artistId");
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing artistId' })
    };
  }

  let sheetId, pushoverToken, pushoverUserKey, telegramChatId;

  try {
    const artistConfig = await getArtistConfig(artistId);
    console.log("🎛️ Loaded artist config:", artistConfig);

    ({
      sheetId,
      pushoverToken,
      pushoverUserKey,
      telegramChatId
    } = artistConfig);
  } catch (err) {
    console.error("❌ Failed to load artist config:", err.message);
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Artist configuration not found.' }),
    };
  }

  const keyPath = path.resolve(__dirname, '_secrets', 'service_account.json');
  const keyFile = fs.readFileSync(keyPath, 'utf8');
  const key = JSON.parse(keyFile);

  const jwtClient = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
  });

  const sheets = google.sheets({ version: 'v4', auth: jwtClient });

  const now = new Date();
  const formattedTime = now.toISOString(); // ← Fixed here
  const row = [formattedTime, method, ip];

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: 'Tip Log!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    // ✅ Try to update most recent request if within 10s from same IP
    async function maybeMarkRecentRequestAsTipped() {
      try {
        const res = await sheets.spreadsheets.values.get({
          spreadsheetId: sheetId,
          range: 'Requests!A2:G1000'
        });

        const rows = res.data.values || [];

        for (let i = rows.length - 1; i >= 0; i--) {
          const [timestamp, , , , rowIP, tipResponse, tipMethod] = rows[i];
          if (rowIP !== ip) continue;

          const requestTime = new Date(timestamp);
          const diffSeconds = (now - requestTime) / 1000;

          if (diffSeconds <= 10 && (!tipResponse || tipResponse.toLowerCase() !== 'yes')) {
            const rowIndex = i + 2;
            await sheets.spreadsheets.values.update({
              spreadsheetId: sheetId,
              range: `Requests!F${rowIndex}:G${rowIndex}`,
              valueInputOption: 'USER_ENTERED',
              requestBody: {
                values: [['Yes', method]]
              }
            });
            console.log(`🔗 Linked tip to request at row ${rowIndex}`);
            break;
          }
        }
      } catch (err) {
        console.error("⚠️ Failed to link tip to recent request:", err.message);
      }
    }

    await maybeMarkRecentRequestAsTipped();

    // Pushover
    if (pushoverToken && pushoverUserKey && method) {
      try {
        const message = `Someone clicked the ${method} tip button.`;
        await fetch('https://api.pushover.net/1/messages.json', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            token: pushoverToken,
            user: pushoverUserKey,
            message,
            title: '💸 Tip Clicked',
            priority: '0'
          })
        });
      } catch (pushErr) {
        console.error("🚫 Pushover error:", pushErr.message);
      }
    }

    // Telegram
    const telegramBotToken = process.env.TELEGRAM_BOT_TOKEN;
    if (telegramBotToken && telegramChatId && method) {
      try {
        const message = `💸 Someone clicked the ${method} tip button.`;
        const telegramUrl = `https://api.telegram.org/bot${telegramBotToken}/sendMessage`;

        await fetch(telegramUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramChatId,
            text: message
          })
        });
      } catch (tgErr) {
        console.error("🚫 Telegram error:", tgErr.message);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true }),
    };

  } catch (error) {
    console.error("❌ log-tip failure:", error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to log tip' }),
    };
  }
};
