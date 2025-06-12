const { GoogleSpreadsheet } = require('google-spreadsheet');
const fetch = require('node-fetch');
const creds = require('./secrets/service_account.json');

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }
  console.log("🧪 Running clean log-request handler");
  console.log("🔐 Loaded creds summary:");
  console.log("  client_email:", creds.client_email);
  console.log("  private_key_id:", creds.private_key_id?.substring(0, 6) + "...");
  const raw = JSON.parse(event.body);
  const sanitize = (str, maxLen = 300) =>
    String(str || '')
      .replace(/[<>]/g, '')
      .replace(/[\u0000-\u001F\u007F]/g, '')
      .trim()
      .substring(0, maxLen);

  const data = {
    artistId: sanitize(raw.artistId, 50),
    name: sanitize(raw.name, 50),
    song: sanitize(raw.song, 150),
    note: sanitize(raw.note, 300),
    ip: sanitize(raw.ip, 45),
    pushoverToken: sanitize(raw.pushoverToken, 50),
    pushoverUserKey: sanitize(raw.pushoverUserKey, 50)
  };

  if (!data.artistId || !data.song) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields: artistId and song are required.' })
    };
  }

  try {
    const configURL = `https://opensheet.elk.sh/${CONFIG_SHEET_ID}/config`;
    const artistConfigs = await fetch(configURL).then(res => res.json());
    const artistRow = artistConfigs.find(row =>
      (row.artistId || '').toLowerCase() === data.artistId.toLowerCase()
    );

    if (!artistRow || !artistRow.songListSheetId) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Artist config not found or missing sheet ID' })
      };
    }

    const targetSheetId = artistRow.songListSheetId;
    const doc = new GoogleSpreadsheet(targetSheetId);
    await doc.useServiceAccountAuth(creds);
    await doc.loadInfo();

    const sheet = doc.sheetsByTitle['Requests'];
    if (!sheet) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Requests tab not found in artist sheet' })
      };
    }

    await sheet.addRow({
      Timestamp: new Date().toISOString(),
      Name: data.name,
      Song: data.song,
      Note: data.note,
      IP: data.ip
    });

    // Pushover
    if (data.pushoverToken && data.pushoverUserKey) {
      await fetch('https://api.pushover.net/1/messages.json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          token: data.pushoverToken,
          user: data.pushoverUserKey,
          title: '🎵 New Song Request',
          message: `${data.song}${data.name ? ' from ' + data.name : ''}${data.note ? '\nNote: ' + data.note : ''}`,
          priority: 0
        })
      });
    }

    // Telegram
    if (artistRow.telegramChatId) {
      await fetch('https://deano-request-page.netlify.app/.netlify/functions/send-telegram-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: artistRow.telegramChatId,
          message: `🎵 New request: ${data.song}${data.name ? ' from ' + data.name : ''}${data.note ? '\nNote: ' + data.note : ''}`
        })
      });
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Request logged and notifications sent' })
    };

  } catch (err) {
    console.error('❌ Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', detail: err.message })
    };
  }
};
