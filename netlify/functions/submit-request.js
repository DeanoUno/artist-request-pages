const { GoogleSpreadsheet } = require('google-spreadsheet');
const fetch = require('node-fetch');
const creds = JSON.parse(process.env.GOOGLE_CREDS_SANIBEL_SONG);

const CONFIG_SHEET_ID = '14csqN2-D55i4LOyKOxfx1AkmKyLbLFrOqlXfSmJJm-c';

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

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

  const required = ['song', 'artistId', 'pushoverToken', 'pushoverUserKey'];
  const missing = required.filter(k => !data[k]);

  if (missing.length) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Missing required fields', missing })
    };
  }

  try {
    // 🔍 Load Artist Config to get target sheet
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

    // ✍️ Log request to the artist's Requests tab
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
      timestamp: new Date().toISOString(),
      name: data.name,
      song: data.song,
      note: data.note,
      ip: data.ip
    });

    // 📲 Send Pushover notification
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

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: 'Request logged and notification sent' })
    };
  } catch (err) {
    console.error('❌ Error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server error', detail: err.message })
    };
  }
};
